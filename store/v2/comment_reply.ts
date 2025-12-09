import { db } from './db';
import { useMySQLBackend } from './index';

export interface CommentReplyAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
  contentID: string;
}

/**
 * 更新 comment 缓存
 * @param reply 缓存
 */
export async function updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'comment_reply', action: 'set', data: reply },
    });
    return true;
  }

  return db.transaction('rw', 'comment_reply', () => {
    db.comment_reply.put(reply, `${reply.url}:${reply.contentID}`);
    return true;
  });
}

/**
 * 获取 comment 缓存
 * @param url
 * @param contentID
 */
export async function getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: CommentReplyAsset }>('/api/db/data', {
        method: 'POST',
        body: { table: 'comment_reply', action: 'get', key: url, contentID },
      });
      return result.code === 0 ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  return db.comment_reply.get(`${url}:${contentID}`);
}
