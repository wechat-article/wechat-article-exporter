import { openDatabase } from './db';

export interface Asset {
  url: string;
  file: Blob;
}

/**
 * 更新 asset 缓存
 * @param asset
 */
export async function updateAssetCache(asset: Asset): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('asset', 'readwrite').objectStore('asset').put(asset);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getAssetCache(url: string): Promise<Asset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('asset').objectStore('asset').get(url);
    request.onsuccess = () => {
      const asset: Asset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
