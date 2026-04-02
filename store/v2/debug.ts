import { base64ToBlob, blobToBase64 } from './helpers';

export interface DebugAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
  fakeid: string;
}

/**
 * 更新 debug 缓存
 */
export async function updateDebugCache(html: DebugAsset): Promise<boolean> {
  const fileBase64 = await blobToBase64(html.file);
  await $fetch('/api/store/debug', {
    method: 'POST',
    body: {
      action: 'update',
      debug: {
        type: html.type,
        url: html.url,
        fakeid: html.fakeid,
        title: html.title,
        file: fileBase64,
        fileType: html.file.type || 'text/html',
      },
    },
  });
  return true;
}

/**
 * 获取 debug 缓存
 */
export async function getDebugCache(url: string): Promise<DebugAsset | undefined> {
  const res = await $fetch<any>('/api/store/debug', {
    query: { action: 'get', url },
  });
  if (!res) return undefined;
  return {
    type: res.type,
    url: res.url,
    fakeid: res.fakeid,
    title: res.title,
    file: base64ToBlob(res.file, res.fileType || 'text/html'),
  };
}

export async function getDebugInfo(): Promise<DebugAsset[]> {
  const res = await $fetch<any[]>('/api/store/debug', {
    query: { action: 'all' },
  });
  return res.map((item: any) => ({
    type: item.type,
    url: item.url,
    fakeid: item.fakeid,
    title: item.title,
    file: base64ToBlob(item.file, item.fileType || 'text/html'),
  }));
}
