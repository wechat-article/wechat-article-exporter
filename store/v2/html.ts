import { base64ToBlob, blobToBase64 } from './helpers';

export interface HtmlAsset {
  fakeid: string;
  url: string;
  file: Blob;
  title: string;
  commentID: string | null;
}

/**
 * 更新 html 缓存
 */
export async function updateHtmlCache(html: HtmlAsset): Promise<boolean> {
  const fileBase64 = await blobToBase64(html.file);
  await $fetch('/api/store/html', {
    method: 'POST',
    body: {
      action: 'update',
      fakeid: html.fakeid,
      url: html.url,
      title: html.title,
      commentID: html.commentID,
      file: fileBase64,
      fileType: html.file.type || 'text/html',
    },
  });
  return true;
}

/**
 * 获取 html 缓存
 */
export async function getHtmlCache(url: string): Promise<HtmlAsset | undefined> {
  const res = await $fetch<any>('/api/store/html', {
    query: { action: 'get', url },
  });
  if (!res) return undefined;
  return {
    fakeid: res.fakeid,
    url: res.url,
    title: res.title,
    commentID: res.commentID,
    file: base64ToBlob(res.file, res.fileType || 'text/html'),
  };
}
