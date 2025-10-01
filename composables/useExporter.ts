import toastFactory from '~/composables/toast';
import { Exporter } from '~/utils/download/Exporter';
import { formatElapsedTime } from '~/utils';
import type { ExporterStatus } from '~/utils/download/types';

export default () => {
  const toast = toastFactory('i-octicon-desktop-download-24');

  const loading = ref(false);
  const phase = ref('导出中');
  const completed_count = ref(0);
  const total_count = ref(0);

  // 导出 excel
  async function export2excel(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    const manager = new Exporter(urls);
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
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success('Excel 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });

    try {
      loading.value = true;
      await manager.startExport('excel');
    } catch (error) {
      console.error('导出任务失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 导出 json
  async function export2json(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    const manager = new Exporter(urls);
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
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success('Json 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });

    try {
      loading.value = true;
      await manager.startExport('json');
    } catch (error) {
      console.error('导出任务失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 导出 html
  async function export2html(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    const manager = new Exporter(urls);
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
    manager.on('export:download:progress', (url: string, success: boolean, status: ExporterStatus) => {
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
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success('HTML 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });

    try {
      loading.value = true;
      await manager.startExport('html');
    } catch (error) {
      console.error('导出任务失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 导出 txt
  async function export2txt(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    const manager = new Exporter(urls);
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
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success('Txt 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });

    try {
      loading.value = true;
      await manager.startExport('txt');
    } catch (error) {
      console.error('导出任务失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 导出 markdown
  async function export2markdown(urls: string[]) {
    if (urls.length === 0) {
      toast.success('提示', '请先选择文章');
      return;
    }

    const manager = new Exporter(urls);
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
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success('Markdown 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });

    try {
      loading.value = true;
      await manager.startExport('markdown');
    } catch (error) {
      console.error('导出任务失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 导出 word
  async function export2word(urls: string[]) {
    if (urls.length === 0) {
      toast.warning('提示', '请先选择文章');
      return;
    }

    const manager = new Exporter(urls);
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
      console.log('耗时:', formatElapsedTime(seconds));
      toast.success('Word 导出完成', `本次导出耗时 ${formatElapsedTime(seconds)}`);
    });

    try {
      loading.value = true;
      await manager.startExport('word');
    } catch (error) {
      console.error('导出任务失败:', error);
      alert((error as Error).message);
    } finally {
      loading.value = false;
    }
  }

  // 导出 pdf
  async function export2pdf(urls: string[]) {}

  function exportFile(type: 'excel' | 'json' | 'html' | 'text' | 'markdown' | 'word' | 'pdf', urls: string[]) {
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
      case 'pdf':
        return export2pdf(urls);
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
