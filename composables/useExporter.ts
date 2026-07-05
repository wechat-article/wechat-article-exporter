import { getErrorMessage } from '#shared/utils/client-error';
import { formatElapsedTime } from '#shared/utils/helpers';
import toastFactory from '~/composables/toast';
import { useProductMetrics } from '~/composables/useProductMetrics';
import { Exporter } from '~/utils/download/Exporter';
import type { DownloadOptions, ExporterStatus } from '~/utils/download/types';

function attachZipFallbackHint(manager: Exporter, toast: ReturnType<typeof toastFactory>) {
  manager.on('export:fallback', (_mode: string, reason: string) => {
    if (reason && (reason.includes('本地/私有化访问') || reason.includes('已跳过文件夹选择'))) {
      return;
    }
    toast.info('提示', reason || '未选择保存文件夹或浏览器限制访问，将以 ZIP 打包下载');
  });
}

export default () => {
  const toast = toastFactory();
  const { track } = useProductMetrics();
  const runtimeConfig = useRuntimeConfig();

  /** 仅影响需目录或 ZIP 的导出（html/txt/markdown/word） */
  function getFsExporterOptions(): DownloadOptions {
    const v = runtimeConfig.public.exportDirectZip as string | boolean | undefined;
    if (v === true || v === 'true') {
      return { directZip: true };
    }
    if (v === false || v === 'false') {
      return { directZip: false };
    }
    return {};
  }

  const loading = ref(false);
  const phase = ref('导出中');
  const completed_count = ref(0);
  const total_count = ref(0);

  async function runExportJob(config: {
    urls: string[];
    exporterOptions: DownloadOptions;
    startType: 'excel' | 'json' | 'html' | 'txt' | 'markdown' | 'word';
    attachZipHint: boolean;
    wireEvents: (m: Exporter) => void;
  }) {
    if (config.urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }
    const manager = new Exporter(config.urls, config.exporterOptions);
    if (config.attachZipHint) {
      attachZipFallbackHint(manager, toast);
    }
    config.wireEvents(manager);
    try {
      loading.value = true;
      await manager.startExport(config.startType);
      track('export_success', { format: config.startType });
    } catch (error) {
      console.error('导出任务失败:', error);
      toast.error('导出失败', getErrorMessage(error));
    } finally {
      loading.value = false;
    }
  }

  function wireExcelJsonEvents(manager: Exporter, doneTitle: string) {
    manager.on('export:begin', () => {
      phase.value = '导出中';
      completed_count.value = 0;
      total_count.value = 0;
    });
    manager.on('export:total', (total: number) => {
      total_count.value = total;
    });
    manager.on('export:progress', (num: number) => {
      completed_count.value = num;
    });
    manager.on('export:finish', (seconds: number) => {
      console.debug('耗时:', formatElapsedTime(seconds));
      toast.success(doneTitle, `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });
  }

  function wireHtmlEvents(manager: Exporter) {
    manager.on('export:begin', () => {
      phase.value = '资源解析中';
      completed_count.value = 0;
      total_count.value = 0;
    });
    manager.on('export:download', (total: number) => {
      phase.value = '资源下载中';
      completed_count.value = 0;
      total_count.value = total;
    });
    manager.on('export:download:progress', (_url: string, _success: boolean, status: ExporterStatus) => {
      completed_count.value = status.completed.length;
    });
    manager.on('export:write', (total: number) => {
      phase.value = '文件写入中';
      completed_count.value = 0;
      total_count.value = total;
    });
    manager.on('export:write:progress', (index: number) => {
      completed_count.value = index;
    });
    manager.on('export:finish', (seconds: number) => {
      console.debug('耗时:', formatElapsedTime(seconds));
      toast.success('HTML 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });
  }

  function wireTxtMarkdownWordEvents(manager: Exporter, doneTitle: string) {
    manager.on('export:begin', () => {
      phase.value = '资源解析中';
      completed_count.value = 0;
      total_count.value = 0;
    });
    manager.on('export:total', (total: number) => {
      phase.value = '导出中';
      completed_count.value = 0;
      total_count.value = total;
    });
    manager.on('export:progress', (index: number) => {
      completed_count.value = index;
    });
    manager.on('export:finish', (seconds: number) => {
      console.debug('耗时:', formatElapsedTime(seconds));
      toast.success(doneTitle, `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });
  }

  async function export2excel(urls: string[]) {
    await runExportJob({
      urls,
      exporterOptions: {},
      startType: 'excel',
      attachZipHint: false,
      wireEvents: m => wireExcelJsonEvents(m, 'Excel 导出完成'),
    });
  }

  async function export2json(urls: string[]) {
    await runExportJob({
      urls,
      exporterOptions: {},
      startType: 'json',
      attachZipHint: false,
      wireEvents: m => wireExcelJsonEvents(m, 'Json 导出完成'),
    });
  }

  async function export2html(urls: string[]) {
    await runExportJob({
      urls,
      exporterOptions: getFsExporterOptions(),
      startType: 'html',
      attachZipHint: true,
      wireEvents: wireHtmlEvents,
    });
  }

  async function export2txt(urls: string[]) {
    await runExportJob({
      urls,
      exporterOptions: getFsExporterOptions(),
      startType: 'txt',
      attachZipHint: true,
      wireEvents: m => wireTxtMarkdownWordEvents(m, 'Txt 导出完成'),
    });
  }

  async function export2markdown(urls: string[]) {
    await runExportJob({
      urls,
      exporterOptions: getFsExporterOptions(),
      startType: 'markdown',
      attachZipHint: true,
      wireEvents: m => wireTxtMarkdownWordEvents(m, 'Markdown 导出完成'),
    });
  }

  async function export2word(urls: string[]) {
    await runExportJob({
      urls,
      exporterOptions: getFsExporterOptions(),
      startType: 'word',
      attachZipHint: true,
      wireEvents: m => wireTxtMarkdownWordEvents(m, 'Word 导出完成'),
    });
  }

  const needsContentFormats = new Set(['html', 'text', 'markdown', 'word']);

  function exportFile(
    type: 'excel' | 'json' | 'html' | 'text' | 'markdown' | 'word',
    urls: string[],
    contentNotDownloadedCount?: number
  ) {
    if (needsContentFormats.has(type) && contentNotDownloadedCount) {
      toast.warning('提示', `有 ${contentNotDownloadedCount} 篇文章尚未抓取内容，请先抓取内容后再导出`);
      return;
    }

    switch (type) {
      case 'excel':
        return export2excel(urls);
      case 'json':
        return export2json(urls);
      case 'html':
        return export2html(urls);
      case 'text':
        return export2txt(urls);
      case 'markdown':
        return export2markdown(urls);
      case 'word':
        return export2word(urls);
    }
  }

  return {
    loading,
    phase,
    completed_count,
    total_count,
    exportFile,
  };
};
