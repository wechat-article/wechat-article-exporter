import { db } from './db';

interface Asset {
  url: string;
  file: Blob;
  fakeid: string;
}

export type { Asset };

/**
 * 更新 asset 缓存
 * @param asset
 */
export async function updateAssetCache(asset: Asset): Promise<boolean> {
  return db.transaction('rw', 'asset', () => {
    db.asset.put(asset);
    return true;
  });
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getAssetCache(url: string): Promise<Asset | undefined> {
  db.transaction('r', 'asset', () => {});
  return db.asset.get(url);
}
