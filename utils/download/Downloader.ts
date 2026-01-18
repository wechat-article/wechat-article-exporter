import { throwException, timeout } from '#shared/utils/helpers';
import usePreferences from '~/composables/usePreferences';
import { getArticleByLink } from '~/store/v2/article';
import { updateCommentCache } from '~/store/v2/comment';
import { updateCommentReplyCache } from '~/store/v2/comment_reply';
import { updateDebugCache } from '~/store/v2/debug';
import { getHtmlCache, updateHtmlCache } from '~/store/v2/html';
import type { Metadata } from '~/store/v2/metadata';
import { updateMetadataCache } from '~/store/v2/metadata';
import type { CommentResponse, ReplyResponse } from '~/types/comment';
import type { ParsedCredential } from '~/types/credential';
import type { Preferences } from '~/types/preferences';
import { BaseDownloader } from '~/utils/download/BaseDownloader';
import type { DownloadOptions } from './types';
import { parseCgiDataNew, validateHTMLContent } from '#shared/utils/html';

type DownloadType = 'html' | 'metadata' | 'comments';

const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);
const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

export class Downloader extends BaseDownloader {
  // 下载的类型
  private downloadType: DownloadType = 'html';

  private isStopping: boolean = false;

  constructor(urls: string[], options: DownloadOptions = {}) {
    super(urls, options);
  }

  // 启动抓取任务
  public async startDownload(type: DownloadType) {
    if (this.isRunning) {
      throw new Error('下载任务正在运行中，无需重复启动');
    }
    this.downloadType = type;

    this.isRunning = true;
    const start = Date.now();
    this.emit('download:begin');
    if (['metadata', 'comments'].includes(this.downloadType) && this.options.concurrency > 2) {
      // 需要Credential爬取的数据，最大并发量设置为2
      this.options.concurrency = 2;
    }

    try {
      await this.processDownloadQueue();
    } finally {
      this.isRunning = false;
      const elapse = Math.round((Date.now() - start) / 1000);
      this.emit('download:finish', elapse, this.getStatus());
      this.cancelAllPending();
    }
  }

  // 停止下载任务
  public stop() {
    this.isStopping = true;
  }

  // 处理下载任务队列
  private async processDownloadQueue() {
    const activePromises: Promise<any>[] = [];

    begin: while (this.urls.length > 0 || activePromises.length > 0) {
      // 检查是否需要启动新的下载任务，需同时满足以下两点:
      // - 没有达到并发量限制
      // - 还有更多 URL 需要下载
      while (activePromises.length < this.options.concurrency && this.urls.length > 0) {
        if (this.isStopping) {
          break begin;
        }

        // 启动新的下载任务
        const url: string = this.urls.pop()!;
        const promise = this.processTask(url);
        activePromises.push(promise);
        promise.finally(() => {
          const index = activePromises.indexOf(promise);
          if (index > -1) {
            activePromises.splice(index, 1);
          }

          // 下载任务结束，触发通知
          this.emit('download:progress', url, this.completed.has(url), this.getStatus());
        });
      }

      // 等待任何活动任务完成
      if (activePromises.length > 0) {
        await Promise.race(activePromises);
      }
    }

    if (this.isStopping) {
      this.emit('download:stop');
    }
  }

  private async processTask(url: string) {
    if (this.downloadType === 'html') {
      return this.downloadHTMLTask(url);
    } else if (this.downloadType === 'metadata') {
      return this.downloadMetadataTask(url);
    } else if (this.downloadType === 'comments') {
      return this.downloadCommentsTask(url);
    }
  }

  // 下载 HTML 任务
  private async downloadHTMLTask(url: string): Promise<void> {
    this.pending.add(url);

    // html 下载时，需要检查缓存是否可用，避免重复下载相同 html 内容
    if (!preferences.value.downloadConfig.forceDownloadContent) {
      const cached = await getHtmlCache(url);
      if (cached) {
        this.pending.delete(url);
        this.completed.add(url);
        return;
      }
    }

    const article = await getArticleByLink(url);
    if (!article) {
      this.pending.delete(url);
      this.failed.add(url);
      return;
    }

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      const proxy = this.proxyManager.getBestProxy();

      try {
        const blob = await this.download(article.fakeid, url, proxy, false);
        const html = await blob.text();
        const [status, commentID] = validateHTMLContent(html);
        if (status === 'Success') {
          // 下载成功
          await updateHtmlCache({
            fakeid: article.fakeid,
            url: url,
            title: article.title,
            file: blob,
            commentID,
          });
          this.pending.delete(url);
          this.completed.add(url);
          this.proxyManager.recordSuccess(proxy);
          return;
        } else if (status === 'Deleted') {
          // 文章被删除
          console.warn(`文章(url: ${url} )已被删除`);

          // 通知外边更新删除状态
          this.emit('download:deleted', url);
          this.pending.delete(url);
          this.deleted.add(url);
          this.proxyManager.recordSuccess(proxy);
          return;
        } else if (status === 'Exception' && commentID) {
          // 文章状态异常
          console.warn(`文章(url: ${url} )状态异常: ${commentID}`);

          // 通知外边更新文章状态
          this.emit('download:exception', url, commentID);
          this.pending.delete(url);
          this.failed.add(url);
          this.proxyManager.recordSuccess(proxy);
          return;
        } else if (status === 'Exception' && !commentID) {
          // 文章下载失败(风控导致的)
          console.warn(`文章(url: ${url} )下载失败(风控所致)`);
          await updateDebugCache({
            fakeid: article.fakeid,
            type: `exception:${commentID}`,
            url: url,
            title: article.title,
            file: blob,
          });
          throwException(`文章(url: ${url} )下载失败`);
        } else if (status === 'Error') {
          // 下载失败
          console.warn(`文章(url: ${url} )解析失败`);
          await updateDebugCache({
            fakeid: article.fakeid,
            type: 'parse error',
            url: url,
            title: article.title,
            file: blob,
          });
          throwException(`文章(url: ${url} )解析失败`);
        }
      } catch (error) {
        await this.handleDownloadFailure(proxy, url, attempt, error);
      }
    }

    this.pending.delete(url);
    this.failed.add(url);
  }

  // 下载阅读量等元数据任务
  private async downloadMetadataTask(url: string): Promise<void> {
    this.pending.add(url);

    const article = await getArticleByLink(url);
    if (!article) {
      this.pending.delete(url);
      this.failed.add(url);
      return;
    }

    // 检查 credentials
    try {
      this.validateCredential(article.fakeid);
    } catch (error) {
      this.pending.delete(url);
      this.failed.add(url);
      throw error;
    }

    for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
      const proxy = this.proxyManager.getBestProxy();

      try {
        const blob = await this.download(article.fakeid, url, proxy, true);
        const html = await blob.text();
        const [status, commentID] = validateHTMLContent(html);
        if (status === 'Success') {
          // 下载成功
          await this.processHtmlMetadata(blob, url);
          // 抓取阅读量时，将带有阅读量的html更新到缓存
          await updateHtmlCache({
            fakeid: article.fakeid,
            url: url,
            title: article.title,
            file: blob,
            commentID,
          });
          this.pending.delete(url);
          this.completed.add(url);
          this.proxyManager.recordSuccess(proxy);
          return;
        } else if (status === 'Deleted') {
          // 文章被删除
          console.warn(`获取阅读量时发现文章(url: ${url} )已被删除`);

          // 通知外边更新删除状态
          this.emit('download:deleted', url);
          this.pending.delete(url);
          this.deleted.add(url);
          this.proxyManager.recordSuccess(proxy);
          return;
        } else if (status === 'Exception' && commentID) {
          // 文章状态异常
          console.warn(`获取阅读量时发现文章(url: ${url} )状态异常: ${commentID}`);

          // 通知外边更新文章状态
          this.emit('download:exception', url, commentID);
          this.pending.delete(url);
          this.failed.add(url);
          this.proxyManager.recordSuccess(proxy);
          return;
        } else if (status === 'Exception' && !commentID) {
          // 文章下载失败(风控导致的)
          console.warn(`文章(url: ${url} )下载失败(风控所致)`);
          await updateDebugCache({
            fakeid: article.fakeid,
            type: `exception:${commentID}`,
            url: url,
            title: article.title,
            file: blob,
          });
          throwException(`文章(url: ${url} )下载失败`);
        } else if (status === 'Error') {
          // 下载文章失败，需要重试
          console.warn(`获取阅读量时发现文章(url: ${url} )解析失败`);
          await updateDebugCache({
            fakeid: article.fakeid,
            type: 'parse error',
            url: url,
            title: article.title,
            file: blob,
          });
          throwException(`文章(url: ${url} )解析失败`);
        }
      } catch (error) {
        await this.handleDownloadFailure(proxy, url, attempt, error);
      }
    }

    this.pending.delete(url);
    this.failed.add(url);
  }

  // 下载留言数据任务
  private async downloadCommentsTask(url: string): Promise<void> {
    this.pending.add(url);

    const article = await getArticleByLink(url);
    if (!article) {
      this.pending.delete(url);
      this.failed.add(url);
      return;
    }

    // 检查 credentials
    try {
      this.validateCredential(article.fakeid);
    } catch (error) {
      this.pending.delete(url);
      this.failed.add(url);
      throw error;
    }

    // 留言数据不进行缓存
    const cached = await getHtmlCache(url);
    if (!cached) {
      // 文章还未下载，不能下载留言
      this.pending.delete(url);
      this.failed.add(url);
      return;
    }
    const title = cached.title;

    // 下载顶级留言
    let buffer = '';
    let continue_flag = true;
    const commentResponseArray: CommentResponse[] = [];

    download_comment: while (continue_flag) {
      for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
        const proxy = this.proxyManager.getBestProxy();

        try {
          const response = await this.fetchComments(article.fakeid, cached.commentID!, buffer, proxy);
          this.proxyManager.recordSuccess(proxy);

          if (response.base_resp.ret === 0) {
            // 留言下载成功
            commentResponseArray.push(response);
            buffer = response.buffer;
            continue_flag = response.continue_flag;
            continue download_comment;
          } else {
            // 留言下载失败
            throwException(`文章(url: ${url} )的评论(${cached.commentID})获取失败`);
          }
        } catch (error) {
          await this.handleDownloadFailure(proxy, url, attempt, error);
        }
      }

      // 走到这里说明已经失败了
      continue_flag = false;
      this.pending.delete(url);
      this.failed.add(url);
      return;
    }
    await updateCommentCache({
      fakeid: article.fakeid,
      url: url,
      title: title,
      data: commentResponseArray,
    });

    // 下载留言回复
    const comments = commentResponseArray
      .flatMap(resp => resp.elected_comment)
      .filter(item => item.reply_new && item.reply_new.reply_total_cnt !== item.reply_new.reply_list.length);

    download_comment_reply: for (const comment of comments) {
      for (let attempt = 0; attempt < this.options.maxRetries; attempt++) {
        const proxy = this.proxyManager.getBestProxy();

        try {
          const response = await this.fetchCommentReply(
            article.fakeid,
            cached.commentID!,
            comment.content_id,
            comment.reply_new.max_reply_id,
            proxy
          );
          this.proxyManager.recordSuccess(proxy);

          if (response.base_resp.ret === 0) {
            // 回复下载成功
            await updateCommentReplyCache({
              fakeid: article.fakeid,
              url: url,
              title: title,
              data: response,
              contentID: comment.content_id,
            });
            continue download_comment_reply;
          } else {
            // 留言下载失败
            throwException(`文章(url: ${url} )的评论回复(${cached.commentID})获取失败`);
          }
        } catch (error) {
          await this.handleDownloadFailure(proxy, url, attempt, error);
        }
      }

      // 走到这里说明已经失败了
      this.pending.delete(url);
      this.failed.add(url);
      return;
    }

    this.pending.delete(url);
    this.completed.add(url);
  }

  // 获取留言数据
  private async fetchComments(
    fakeid: string,
    commentID: string,
    buffer: string,
    proxy: string
  ): Promise<CommentResponse> {
    const abortController = new AbortController();
    this.abortControllers.set(commentID, abortController);

    try {
      // 使用设置的 credentials 来抓取留言
      const targetCredential = credentials.value.find(item => item.biz === fakeid && item.valid);
      if (!targetCredential) {
        throw new Error('目标公众号的 Credential 未设置');
      }

      const Authorization = (preferences.value as Preferences).privateProxyAuthorization || '';
      const url = `https://mp.weixin.qq.com/mp/appmsg_comment?action=getcomment&__biz=${targetCredential.biz}&comment_id=${commentID}&uin=${targetCredential.uin}&key=${targetCredential.key}&pass_ticket=${targetCredential.pass_ticket}&buffer=${buffer}&offset=1&limit=100&f=json`;
      const proxyUrl = `${proxy}?url=${encodeURIComponent(url)}&authorization=${Authorization}`;
      const response = (await Promise.race([
        fetch(proxyUrl, {
          signal: abortController.signal,
          referrerPolicy: 'unsafe-url',
        }),
        timeout(this.options.timeout),
      ])) as Response;

      if (!response || !response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } finally {
      this.abortControllers.delete(commentID);
    }
  }

  // 获取留言评论
  private async fetchCommentReply(
    fakeid: string,
    commentID: string,
    contentID: string,
    maxReplyID: number,
    proxy: string
  ): Promise<ReplyResponse> {
    const abortController = new AbortController();
    this.abortControllers.set(commentID + ':' + contentID, abortController);

    try {
      // 使用设置的 credentials 来抓取留言
      const targetCredential = credentials.value.find(item => item.biz === fakeid && item.valid);
      if (!targetCredential) {
        throw new Error('目标公众号的 Credential 未设置');
      }

      const Authorization = (preferences.value as Preferences).privateProxyAuthorization || '';
      const url = `https://mp.weixin.qq.com/mp/appmsg_comment?action=getcommentreply&__biz=${targetCredential.biz}&comment_id=${commentID}&uin=${targetCredential.uin}&key=${targetCredential.key}&pass_ticket=${targetCredential.pass_ticket}&content_id=${contentID}&max_reply_id=${maxReplyID}&limit=100&f=json`;
      const proxyUrl = `${proxy}?url=${encodeURIComponent(url)}&authorization=${Authorization}`;
      const response = (await Promise.race([
        fetch(proxyUrl, {
          signal: abortController.signal,
          referrerPolicy: 'unsafe-url',
        }),
        timeout(this.options.timeout),
      ])) as Response;

      if (!response || !response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.json();
    } finally {
      this.abortControllers.delete(commentID);
    }
  }

  // 提取 HTML 中的元数据(阅读、点赞、分享、喜欢、留言)，并写入缓存
  private async processHtmlMetadata(blob: Blob, url: string): Promise<void> {
    const html = await blob.text();

    // 提取对象字符串
    const cgiData = await parseCgiDataNew(html);
    if (!cgiData) {
      console.error('提取 window.cgiData 对象失败');
      return;
    }

    let readNum = 0;
    let oldLikeNum = 0;
    let shareNum = 0;
    let likeNum = 0;
    let commentNum = 0;

    try {
      const appmsg_bar_data = cgiData.user_info.appmsg_bar_data;
      readNum = appmsg_bar_data.read_num; // 阅读量
      oldLikeNum = appmsg_bar_data.old_like_count; //点赞
      shareNum = appmsg_bar_data.share_count; //分享
      likeNum = appmsg_bar_data.like_count; // 喜欢
      commentNum = appmsg_bar_data.comment_count; // 留言
    } catch (e) {
      console.error('解析对象失败:', e);
      return;
    }

    const article = await getArticleByLink(url);

    // 写入元数据表
    const metadata: Metadata = {
      fakeid: article.fakeid,
      url,
      title: article.title,
      readNum,
      oldLikeNum,
      shareNum,
      likeNum,
      commentNum,
    };
    this.emit('download:metadata', url, metadata);
    await updateMetadataCache(metadata);
  }
}
