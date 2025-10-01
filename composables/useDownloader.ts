import { Downloader } from '~/utils/download/Downloader';
import type { DownloaderStatus } from '~/utils/download/types';
import type { Metadata } from '~/store/v2/metadata';
import toastFactory from '~/composables/toast';
import { formatElapsedTime } from '~/utils';

export interface DownloadArticleOptions {
  // 文章内容下载成功回调
  onContent: (url: string) => void;

  // 文章被删除回调
  onDelete: (url: string) => void;

  // 文章在审核中回调 (效果等于文章被删除，但是后续可能会审核通过，所以不能修改缓存中的 is_deleted 字段，只需要从 grid 中去除即可)
  onChecking: (url: string) => void;

  // 文章阅读量抓取成功回调
  onMetadata: (url: string, metadata: Metadata) => void;

  // 文章留言抓取成功回调
  onComment: (url: string) => void;
}

export default (options: Partial<DownloadArticleOptions> = {}) => {
  const toast = toastFactory('i-octicon-desktop-download-24');

  const loading = ref(false);
  const completed_count = ref(0);
  const total_count = ref(0);

  let manager: Downloader | null = null;

  // 抓取文章内容(html)
  async function downloadArticleHTML(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    manager = new Downloader(urls);
    manager.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
      console.log(
        `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
      );
      completed_count.value = status.completed.length;
      if (success && typeof options.onContent === 'function') {
        options.onContent(url);
      }
    });
    manager.on('download:deleted', (url: string) => {
      if (typeof options.onDelete === 'function') {
        options.onDelete(url);
      }
    });
    manager.on('download:checking', (url: string) => {
      if (typeof options.onChecking === 'function') {
        options.onChecking(url);
      }
    });
    manager.on('download:begin', () => {
      console.log('开始抓取【文章内容】...');
      completed_count.value = 0;
      total_count.value = urls.length;
    });
    manager.on('download:finish', (seconds: number, status: DownloaderStatus) => {
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success(
        '【文章内容】抓取完成',
        `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`
      );
    });
    manager.on('download:stop', () => {
      toast.info('HTML下载任务已停止');
    });

    try {
      loading.value = true;
      await manager.startDownload('html');
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

    manager = new Downloader(urls);
    manager.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
      console.log(
        `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
      );
      completed_count.value = status.completed.length;
    });
    manager.on('download:metadata', (url: string, metadata: Metadata) => {
      if (typeof options.onMetadata === 'function') {
        options.onMetadata(url, metadata);
      }
    });
    manager.on('download:deleted', (url: string) => {
      if (typeof options.onDelete === 'function') {
        options.onDelete(url);
      }
    });
    manager.on('download:checking', (url: string) => {
      if (typeof options.onChecking === 'function') {
        options.onChecking(url);
      }
    });
    manager.on('download:begin', () => {
      console.log('开始抓取【阅读量】...');
      completed_count.value = 0;
      total_count.value = urls.length;
    });
    manager.on('download:finish', (seconds: number, status: DownloaderStatus) => {
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success(
        '【阅读量】抓取完成',
        `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`
      );
    });

    try {
      loading.value = true;
      await manager.startDownload('metadata');
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

    manager = new Downloader(urls);
    manager.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
      console.log(
        `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
      );
      completed_count.value = status.completed.length;
      if (success && typeof options.onComment === 'function') {
        options.onComment(url);
      }
    });
    manager.on('download:begin', () => {
      console.log('开始抓取【留言内容】...');
      completed_count.value = 0;
      total_count.value = urls.length;
    });
    manager.on('download:finish', (seconds: number, status: DownloaderStatus) => {
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success(
        '【留言内容】抓取完成',
        `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}`
      );
    });

    try {
      loading.value = true;
      await manager.startDownload('comments');
    } catch (error) {
      console.error('【留言内容】抓取失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  async function download(type: 'html' | 'metadata' | 'comment', urls: string[]) {
    if (type === 'html') {
      await downloadArticleHTML(urls);
    } else if (type === 'metadata') {
      await downloadArticleMetadata(urls);
    } else if (type === 'comment') {
      await downloadArticleComment(urls);
    }
  }

  function stop() {
    if (manager) {
      manager.stop();
      manager = null;
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
