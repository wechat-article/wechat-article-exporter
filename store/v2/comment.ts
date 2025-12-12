import { db } from './db';
import { useMySQLBackend } from './index';

export interface CommentAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
}

/**
 * 更新 comment 缓存
 * @param comment 缓存
 */
export async function updateCommentCache(comment: CommentAsset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'comment', action: 'set', data: comment },
    });
    return true;
  }

  return db.transaction('rw', 'comment', () => {
    db.comment.put(comment);
    return true;
  });
}

/**
 * 获取 comment 缓存
 * @param url
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: CommentAsset }>('/api/db/data', {
        method: 'POST',
        body: { table: 'comment', action: 'get', key: url },
      });
      return result.code === 0 ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  return db.comment.get(url);
}
