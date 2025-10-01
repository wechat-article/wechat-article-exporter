import { openDatabase } from './db';

export interface CommentAsset {
  url: string;
  title: string;
  data: any;
}

/**
 * 更新 comment 缓存
 * @param comment 缓存
 */
export async function updateCommentCache(comment: CommentAsset): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('comment', 'readwrite').objectStore('comment').put(comment);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 comment 缓存
 * @param url
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('comment').objectStore('comment').get(url);
    request.onsuccess = () => {
      const asset: CommentAsset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
