import { format } from 'date-fns';
import { saveAs } from 'file-saver';
import JSZip from 'jszip';
import { getErrorMessage } from '#shared/utils/client-error';
import toastFactory from '~/composables/toast';
import type { DownloadableArticle } from '~/types/types';
import { downloadArticleHTMLs, packHTMLAssets } from '~/utils';

/**
 * 批量下载合集文章
 */
export function useDownloadAlbum() {
  const toast = toastFactory();
  const loading = ref(false);
  const phase = ref();
  const downloadedCount = ref(0);
  const packedCount = ref(0);

  async function download(articles: DownloadableArticle[], filename: string) {
    loading.value = true;

    try {
      phase.value = '下载文章内容';
      const results = await downloadArticleHTMLs(articles, (count: number) => {
        downloadedCount.value = count;
      });

      phase.value = '打包';
      const zip = new JSZip();
      for (const article of results) {
        await packHTMLAssets(
          article.fakeid,
          article.html!,
          article.title.replaceAll('.', '_'),
          zip.folder(format(new Date(+article.date * 1000), 'yyyy-MM-dd') + ' ' + article.title.replace(/\//g, '_'))!
        );
        packedCount.value++;
      }

      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `${filename}.zip`);
    } catch (e: unknown) {
      toast.error('合集打包失败', getErrorMessage(e));
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
    download,
  };
}
