import { db } from './db';

export interface DebugAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
  fakeid: string;
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateDebugCache(html: DebugAsset): Promise<boolean> {
  return db.transaction('rw', 'debug', () => {
    db.debug.put(html);
    return true;
  });
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getDebugCache(url: string): Promise<DebugAsset | undefined> {
  return db.debug.get(url);
}

export async function getDebugInfo(): Promise<DebugAsset[]> {
  return db.debug.toArray();
}
