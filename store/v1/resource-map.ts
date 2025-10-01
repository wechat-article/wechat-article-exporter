import { openDatabase } from './db';

export interface ResourceMapAsset {
  url: string;
  resources: string[];
}

/**
 * 更新 resource-map 缓存
 * @param resourceMap 缓存
 */
export async function updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('resource-map', 'readwrite').objectStore('resource-map').put(resourceMap);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 resource-map 缓存
 * @param url
 */
export async function getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('resource-map').objectStore('resource-map').get(url);
    request.onsuccess = () => {
      const asset: ResourceMapAsset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
