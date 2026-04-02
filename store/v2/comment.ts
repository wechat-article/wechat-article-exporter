export interface CommentAsset {
  fakeid: string;
  url: string;
  title: string;
  data: any;
}

/**
 * 更新 comment 缓存
 */
export async function updateCommentCache(comment: CommentAsset): Promise<boolean> {
  await $fetch('/api/store/comment', {
    method: 'POST',
    body: { action: 'update', comment },
  });
  return true;
}

/**
 * 获取 comment 缓存
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
  const res = await $fetch<CommentAsset | null>('/api/store/comment', {
    query: { action: 'get', url },
  });
  return res || undefined;
}
