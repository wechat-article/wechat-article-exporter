import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { sleep } from '#shared/utils/helpers';
import type { DownloadableArticle } from '~/types/types';
import { downloadArticleHTMLs, packHTMLAssets } from '~/utils';
import { DEFAULT_CHUNK_SIZE } from '~/composables/useDownloadSettings';

/**
 * 单个分包在下载 / 打包失败时的最大重试次数。
 */
const MAX_CHUNK_RETRIES = 3;

/**
 * 分包失败重试之间的等待时间(ms)。
 */
const RETRY_DELAY = 3000;

/**
 * 进度状态在 localStorage 中的 key 前缀，用于断点续传。
 */
const PROGRESS_KEY_PREFIX = 'album-download-progress:';

type ChunkStatus = 'pending' | 'done' | 'failed';

interface ChunkState {
  // 分包序号(从 0 开始)
  index: number;
  // 该分包对应文章在整体列表中的起始下标
  start: number;
  // 该分包对应文章在整体列表中的结束下标(不含)
  end: number;
  // 分包状态
  status: ChunkStatus;
}

interface TaskProgress {
  // 任务唯一标识
  taskId: string;
  // 下载文件名(不含扩展名)
  filename: string;
  // 文章总数(用于校验任务是否匹配)
  total: number;
  // 分包大小
  chunkSize: number;
  // 各分包状态
  chunks: ChunkState[];
  // 最近更新时间
  updatedAt: number;
}

interface DownloadOptions {
  // 任务唯一标识(用于断点续传，建议传入 fakeid + album_id)，默认使用 filename
  taskId?: string;
  // 分包大小
  chunkSize?: number;
}

export function useDownloadAlbum() {
  // 是否正在下载
  const loading = ref(false);
  // 当前阶段文案: '准备中' | '下载文章内容' | '打包压缩' | '完成'
  const phase = ref<string>('');
  // 当前分包内已下载的文章数
  const downloadedCount = ref(0);
  // 当前分包内已打包的文章数
  const packedCount = ref(0);
  // 当前正在处理的分包序号(从 1 开始，便于展示)
  const currentChunk = ref(0);
  // 分包总数
  const totalChunks = ref(0);
  // 已成功完成的分包数
  const completedChunks = ref(0);
  // 失败的分包序号列表(从 1 开始)
  const failedChunks = ref<number[]>([]);
  // 文章总数
  const totalArticles = ref(0);
  // 面向用户的整体状态文案
  const statusText = ref('');
  // 是否存在可续传的历史进度
  const resumable = ref(false);

  // 整体进度百分比(0-100)，以分包为粒度
  const overallProgress = computed(() => {
    if (totalChunks.value === 0) return 0;
    return Math.floor((completedChunks.value / totalChunks.value) * 100);
  });

  /**
   * 从 localStorage 读取任务进度
   */
  function loadProgress(taskId: string): TaskProgress | null {
    try {
      const raw = window.localStorage.getItem(PROGRESS_KEY_PREFIX + taskId);
      if (!raw) return null;
      return JSON.parse(raw) as TaskProgress;
    } catch {
      return null;
    }
  }

  /**
   * 持久化任务进度
   */
  function saveProgress(progress: TaskProgress) {
    try {
      progress.updatedAt = Date.now();
      window.localStorage.setItem(PROGRESS_KEY_PREFIX + progress.taskId, JSON.stringify(progress));
    } catch (e) {
      console.warn('保存下载进度失败', e);
    }
  }

  /**
   * 清除任务进度
   */
  function clearProgress(taskId: string) {
    try {
      window.localStorage.removeItem(PROGRESS_KEY_PREFIX + taskId);
    } catch {}
  }

  /**
   * 根据文章总数与分包大小构建分包列表
   */
  function buildChunks(total: number, chunkSize: number): ChunkState[] {
    const chunks: ChunkState[] = [];
    let index = 0;
    for (let start = 0; start < total; start += chunkSize) {
      chunks.push({
        index,
        start,
        end: Math.min(start + chunkSize, total),
        status: 'pending',
      });
      index++;
    }
    return chunks;
  }

  /**
   * 检测某个任务是否存在可续传的进度(还有未完成的分包)
   * @param chunkSize 当前选定的分包大小；若与历史进度不一致则视为不可续传
   */
  function checkResumable(taskId: string, total: number, chunkSize: number = DEFAULT_CHUNK_SIZE): boolean {
    const saved = loadProgress(taskId);
    const ok =
      !!saved && saved.total === total && saved.chunkSize === chunkSize && saved.chunks.some(c => c.status !== 'done');
    resumable.value = ok;
    return ok;
  }

  /**
   * 生成分包文件名
   */
  function buildPartFilename(filename: string, index: number, totalParts: number): string {
    if (totalParts <= 1) {
      return `${filename}.zip`;
    }
    // 序号从 1 开始，并做零填充，方便文件排序
    const pad = String(totalParts).length;
    const seq = String(index + 1).padStart(pad, '0');
    return `${filename}-part${seq}-of${totalParts}.zip`;
  }

  /**
   * 处理单个分包：下载文章 -> 打包资源 -> 生成 zip -> 保存。
   * 内含失败重试；每个分包独立生成并保存后释放内存，避免内存累积。
   * @returns 该分包成功打包的文章数量；失败则抛出异常
   */
  async function processChunk(
    articles: DownloadableArticle[],
    chunk: ChunkState,
    filename: string,
    totalParts: number
  ): Promise<number> {
    const chunkArticles = articles.slice(chunk.start, chunk.end);
    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_CHUNK_RETRIES; attempt++) {
      // 每个分包/每次重试都使用全新的 JSZip 实例，避免残留数据占用内存
      let zip: JSZip | null = new JSZip();
      try {
        // 阶段一：下载文章 HTML
        phase.value = '下载文章内容';
        downloadedCount.value = 0;
        const results = await downloadArticleHTMLs(chunkArticles, (count: number) => {
          downloadedCount.value = count;
        });

        // 阶段二：打包资源
        phase.value = '打包压缩';
        packedCount.value = 0;
        for (const article of results) {
          await packHTMLAssets(
            article.fakeid,
            article.html!,
            article.title.replaceAll('.', '_'),
            zip.folder(
              format(new Date(+article.date * 1000), 'yyyy-MM-dd') + ' ' + article.title.replace(/\//g, '_')
            )!
          );
          packedCount.value++;
          // 打包完成后释放该文章的 html 引用，尽早回收内存
          article.html = undefined;
        }

        // 阶段三：生成 zip Blob 并保存
        const blob = await zip.generateAsync({
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 },
        });
        saveAs(blob, buildPartFilename(filename, chunk.index, totalParts));

        // 释放引用，帮助 GC
        zip = null;

        return results.length;
      } catch (e) {
        lastError = e;
        zip = null;
        console.error(`分包 ${chunk.index + 1} 第 ${attempt} 次尝试失败`, e);
        if (attempt < MAX_CHUNK_RETRIES) {
          statusText.value = `分包 ${chunk.index + 1} 打包失败，正在重试(${attempt}/${MAX_CHUNK_RETRIES})...`;
          await sleep(RETRY_DELAY);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  /**
   * 批量下载合集文章。
   * - 分包处理：按 chunkSize 拆分为多个 zip 分包，逐包下载/打包/保存，避免内存溢出
   * - 断点续传：进度持久化到 localStorage，已完成的分包在续传时自动跳过
   * - 失败重试：单个分包失败自动重试；重试仍失败则记录，其余分包继续
   */
  async function download(articles: DownloadableArticle[], filename: string, options: DownloadOptions = {}) {
    if (loading.value) return;
    if (!articles.length) return;

    loading.value = true;
    const taskId = options.taskId || filename;
    const chunkSize = options.chunkSize && options.chunkSize > 0 ? options.chunkSize : DEFAULT_CHUNK_SIZE;

    // 初始化 / 恢复进度
    let progress = loadProgress(taskId);
    if (!progress || progress.total !== articles.length || progress.chunkSize !== chunkSize) {
      // 无历史进度或任务已变化，重新构建
      progress = {
        taskId,
        filename,
        total: articles.length,
        chunkSize,
        chunks: buildChunks(articles.length, chunkSize),
        updatedAt: Date.now(),
      };
      saveProgress(progress);
    }

    // 初始化响应式状态
    totalArticles.value = articles.length;
    totalChunks.value = progress.chunks.length;
    completedChunks.value = progress.chunks.filter(c => c.status === 'done').length;
    failedChunks.value = [];
    currentChunk.value = 0;
    phase.value = '准备中';
    statusText.value = '';

    const skipped = completedChunks.value;
    if (skipped > 0) {
      statusText.value = `检测到历史进度，将从断点继续(已完成 ${skipped}/${totalChunks.value} 个分包)`;
    }

    try {
      for (const chunk of progress.chunks) {
        // 断点续传：已完成的分包直接跳过
        if (chunk.status === 'done') {
          continue;
        }

        currentChunk.value = chunk.index + 1;

        try {
          await processChunk(articles, chunk, filename, progress.chunks.length);
          chunk.status = 'done';
          completedChunks.value++;
        } catch (e: any) {
          chunk.status = 'failed';
          failedChunks.value.push(chunk.index + 1);
          console.error(`分包 ${chunk.index + 1} 最终打包失败`, e);
        } finally {
          // 每处理完一个分包立即持久化进度
          saveProgress(progress);
        }
      }

      phase.value = '完成';
      if (failedChunks.value.length > 0) {
        statusText.value = `下载完成，但有 ${failedChunks.value.length} 个分包失败(分包: ${failedChunks.value.join(
          ', '
        )})，可点击"继续下载"重试失败分包`;
        resumable.value = true;
      } else {
        // 全部成功，清除进度记录
        clearProgress(taskId);
        resumable.value = false;
        statusText.value =
          totalChunks.value > 1
            ? `全部完成，共 ${totalChunks.value} 个分包已下载`
            : '下载完成';
      }
    } catch (e: any) {
      // 意外的整体异常(如无可用代理)，保留进度以便续传
      statusText.value = `下载中断：${e?.message || e}，可稍后点击"继续下载"恢复`;
      resumable.value = true;
      console.error(e);
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    phase,
    downloadedCount,
    packedCount,
    currentChunk,
    totalChunks,
    completedChunks,
    failedChunks,
    totalArticles,
    statusText,
    resumable,
    overallProgress,
    download,
    checkResumable,
    clearProgress,
  };
}
