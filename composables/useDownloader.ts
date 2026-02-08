import { formatElapsedTime } from '#shared/utils/helpers';
import toastFactory from '~/composables/toast';
import type { Metadata } from '~/store/v2/metadata';
import { Downloader } from '~/utils/download/Downloader';
import type { DownloaderStatus } from '~/utils/download/types';

export interface DownloadArticleOptions {
  // 文章内容下载成功回调
  onContent: (url: string) => void;

  // 文章状态异常回调(不含「已删除」)
  onStatusChange: (url: string, status: string) => void;

  // 文章被删除回调
  onDelete: (url: string) => void;

  // 文章阅读量抓取成功回调
  onMetadata: (url: string, metadata: Metadata) => void;

  // 文章留言抓取成功回调
  onComment: (url: string) => void;

  // 修复单篇文章下载的 fakeid 专用
  onFakeID: (url: string, fakeid: string) => void;
}

export default (options: Partial<DownloadArticleOptions> = {}) => {
  const toast = toastFactory();

  const loading = ref(false);
  const completed_count = ref(0);
  const total_count = ref(0);

  let downloader: Downloader | null = null;

  // 抓取文章内容(html)
  async function downloadArticleHTML(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      loading.value = true;

      downloader = new Downloader(urls);
      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        console.debug(
          `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
        );
        completed_count.value = status.completed.length;
        if (success && typeof options.onContent === 'function') {
          options.onContent(url);
        }
      });
      downloader.on('download:deleted', (url: string) => {
        if (typeof options.onDelete === 'function') {
          options.onDelete(url);
        }
      });
      downloader.on('download:exception', (url: string, msg: string) => {
        if (typeof options.onStatusChange === 'function') {
          options.onStatusChange(url, msg);
        }
      });
      downloader.on('download:begin', () => {
        console.debug('开始抓取【文章内容】...');
        completed_count.value = 0;
        total_count.value = urls.length;
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【文章内容】抓取完成',
          `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`
        );
      });
      downloader.on('download:stop', () => {
        toast.info('HTML下载任务已停止');
      });

      await downloader.startDownload('html');
    } catch (error) {
      console.error('【文章内容】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 抓取文章阅读量、点赞量等元数据
  async function downloadArticleMetadata(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      loading.value = true;

      downloader = new Downloader(urls);
      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        console.debug(
          `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
        );
        completed_count.value = status.completed.length;
      });
      downloader.on('download:metadata', (url: string, metadata: Metadata) => {
        if (typeof options.onMetadata === 'function') {
          options.onMetadata(url, metadata);
        }
      });
      downloader.on('download:deleted', (url: string) => {
        if (typeof options.onDelete === 'function') {
          options.onDelete(url);
        }
      });
      downloader.on('download:exception', (url: string, msg: string) => {
        if (typeof options.onStatusChange === 'function') {
          options.onStatusChange(url, msg);
        }
      });
      downloader.on('download:begin', () => {
        console.debug('开始抓取【阅读量】...');
        completed_count.value = 0;
        total_count.value = urls.length;
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【阅读量】抓取完成',
          `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`
        );
      });

      await downloader.startDownload('metadata');
    } catch (error) {
      console.error('【阅读量】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 抓取文章留言数据
  async function downloadArticleComment(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      loading.value = true;

      downloader = new Downloader(urls);
      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        console.debug(
          `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
        );
        completed_count.value = status.completed.length;
        if (success && typeof options.onComment === 'function') {
          options.onComment(url);
        }
      });
      downloader.on('download:begin', () => {
        console.debug('开始抓取【留言内容】...');
        completed_count.value = 0;
        total_count.value = urls.length;
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【留言内容】抓取完成',
          `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}`
        );
      });

      await downloader.startDownload('comments');
    } catch (error) {
      console.error('【留言内容】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 修复单篇文章fakeid
  async function fixSingleFakeidTask(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    try {
      loading.value = true;

      downloader = new Downloader(urls);
      downloader.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
        console.debug(
          `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length})`
        );
        completed_count.value = status.completed.length;
      });
      downloader.on('download:begin', () => {
        console.debug('开始修复 fakeid ...');
        completed_count.value = 0;
        total_count.value = urls.length;
      });
      downloader.on('fix:fakeid', (url: string, fakeid: string) => {
        console.debug(`${url} 修复成功 fakeid: ${fakeid}`);
        if (typeof options.onFakeID === 'function') {
          options.onFakeID(url, fakeid);
        }
      });
      downloader.on('download:finish', (seconds: number, status: DownloaderStatus) => {
        console.debug('耗时:', formatElapsedTime(seconds));
        toast.success(
          '【fakeid】修复完成',
          `本次耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}`
        );
      });

      await downloader.startDownload('fakeid');
    } catch (error) {
      console.error('【fakeid】修复失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  async function download(type: 'html' | 'metadata' | 'comment' | 'fakeid', urls: string[]) {
    if (type === 'html') {
      await downloadArticleHTML(urls);
    } else if (type === 'metadata') {
      await downloadArticleMetadata(urls);
    } else if (type === 'comment') {
      await downloadArticleComment(urls);
    } else if (type === 'fakeid') {
      await fixSingleFakeidTask(urls);
    }
  }

  function stop() {
    if (downloader) {
      downloader.stop();
      downloader = null;
    }
  }

  return {
    loading,
    completed_count,
    total_count,
    download,
    stop,
  };
};
