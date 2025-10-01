import { openDatabase } from './db';

export interface ResourceAsset {
  url: string;
  file: Blob;
}

/**
 * 更新 resource 缓存
 * @param resource 缓存
 */
export async function updateResourceCache(resource: ResourceAsset): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('resource', 'readwrite').objectStore('resource').put(resource);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 resource 缓存
 * @param url
 */
export async function getResourceCache(url: string): Promise<ResourceAsset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('resource').objectStore('resource').get(url);
    request.onsuccess = () => {
      const asset: ResourceAsset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
