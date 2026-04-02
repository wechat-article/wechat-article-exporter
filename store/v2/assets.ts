import { base64ToBlob, blobToBase64 } from './helpers';

interface Asset {
  url: string;
  file: Blob;
  fakeid: string;
}

export type { Asset };

/**
 * 更新 asset 缓存
 */
export async function updateAssetCache(asset: Asset): Promise<boolean> {
  const fileBase64 = await blobToBase64(asset.file);
  await $fetch('/api/store/asset', {
    method: 'POST',
    body: {
      action: 'update',
      asset: {
        url: asset.url,
        fakeid: asset.fakeid,
        file: fileBase64,
        fileType: asset.file.type || 'application/octet-stream',
      },
    },
  });
  return true;
}

/**
 * 获取 asset 缓存
 */
export async function getAssetCache(url: string): Promise<Asset | undefined> {
  const res = await $fetch<any>('/api/store/asset', {
    query: { action: 'get', url },
  });
  if (!res) return undefined;
  return {
    url: res.url,
    fakeid: res.fakeid,
    file: base64ToBlob(res.file, res.fileType || 'application/octet-stream'),
  };
}
