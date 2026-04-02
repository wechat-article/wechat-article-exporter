export interface CommentReplyAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
  contentID: string;
}

/**
 * 更新 comment reply 缓存
 */
export async function updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean> {
  await $fetch('/api/store/comment-reply', {
    method: 'POST',
    body: { action: 'update', reply },
  });
  return true;
}

/**
 * 获取 comment reply 缓存
 */
export async function getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
  const res = await $fetch<CommentReplyAsset | null>('/api/store/comment-reply', {
    query: { action: 'get', url, contentID },
  });
  return res || undefined;
}
