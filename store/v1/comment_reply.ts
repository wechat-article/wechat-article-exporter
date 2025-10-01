import { openDatabase } from './db';

export interface CommentReplyAsset {
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
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction('comment_reply', 'readwrite')
      .objectStore('comment_reply')
      .put(reply, `${reply.url}:${reply.contentID}`);
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
 * @param contentID
 */
export async function getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('comment_reply').objectStore('comment_reply').get(`${url}:${contentID}`);
    request.onsuccess = () => {
      const asset: CommentReplyAsset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
