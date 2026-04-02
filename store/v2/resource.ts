import { base64ToBlob, blobToBase64 } from './helpers';

export interface ResourceAsset {
  fakeid: string;
  url: string;
  file: Blob;
}

/**
 * 更新 resource 缓存
 */
export async function updateResourceCache(resource: ResourceAsset): Promise<boolean> {
  const fileBase64 = await blobToBase64(resource.file);
  await $fetch('/api/store/resource', {
    method: 'POST',
    body: {
      action: 'update',
      resource: {
        fakeid: resource.fakeid,
        url: resource.url,
        file: fileBase64,
        fileType: resource.file.type || 'application/octet-stream',
      },
    },
  });
  return true;
}

/**
 * 获取 resource 缓存
 */
export async function getResourceCache(url: string): Promise<ResourceAsset | undefined> {
  const res = await $fetch<any>('/api/store/resource', {
    query: { action: 'get', url },
  });
  if (!res) return undefined;
  return {
    fakeid: res.fakeid,
    url: res.url,
    file: base64ToBlob(res.file, res.fileType || 'application/octet-stream'),
  };
}
