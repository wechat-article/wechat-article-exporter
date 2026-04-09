import type { AppMsgExWithFakeID, PublishPage } from '~/types/types';
import type { MpAccount } from './info';

export type ArticleAsset = AppMsgExWithFakeID;

/**
 * 更新文章缓存
 * @param account
 * @param publish_page
 */
export async function updateArticleCache(account: MpAccount, publish_page: PublishPage) {
  await $fetch('/api/store/article', {
    method: 'POST',
    body: {
      action: 'updateCache',
      account: {
        fakeid: account.fakeid,
        nickname: account.nickname,
        round_head_img: account.round_head_img,
      },
      publishPage: publish_page,
    },
  });
}

/**
 * 检查是否存在指定更新时间之前的缓存
 */
export async function hitCache(fakeid: string, update_time: number): Promise<boolean> {
  const res = await $fetch<{ hit: boolean }>('/api/store/article', {
    query: { action: 'hitCache', fakeid, update_time },
  });
  return res.hit;
}

/**
 * 读取缓存中的指定更新时间之前的历史文章
 */
export async function getArticleCache(fakeid: string, update_time: number): Promise<AppMsgExWithFakeID[]> {
  return await $fetch<AppMsgExWithFakeID[]>('/api/store/article', {
    query: { action: 'getCache', fakeid, update_time },
  });
}

/**
 * 根据 url 获取文章对象
 */
export async function getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  const article = await $fetch<AppMsgExWithFakeID | null>('/api/store/article', {
    query: { action: 'byLink', url },
  });
  if (!article) {
    throw new Error(`Article(${url}) does not exist`);
  }
  return article;
}

/**
 * 根据 url 获取 SINGLE_ARTICLE_FAKEID 文章对象
 */
export async function getSingleArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  const article = await $fetch<AppMsgExWithFakeID | null>('/api/store/article', {
    query: { action: 'singleByLink', url },
  });
  if (!article) {
    throw new Error(`Article(${url}) does not exist`);
  }
  return article;
}

/**
 * 文章被删除
 */
export async function articleDeleted(url: string, is_deleted = true): Promise<void> {
  await $fetch('/api/store/article', {
    method: 'POST',
    body: { action: 'deleted', url, is_deleted },
  });
}

/**
 * 更新文章状态
 */
export async function updateArticleStatus(url: string, status: string): Promise<void> {
  await $fetch('/api/store/article', {
    method: 'POST',
    body: { action: 'updateStatus', url, status },
  });
}

/**
 * 更新文章的fakeid
 */
export async function updateArticleFakeid(url: string, fakeid: string): Promise<void> {
  await $fetch('/api/store/article', {
    method: 'POST',
    body: { action: 'updateFakeid', url, fakeid },
  });
}

/**
 * 插入/更新文章 (供 single.vue 使用)
 */
export async function putArticle(data: AppMsgExWithFakeID, id: string): Promise<void> {
  await $fetch('/api/store/article', {
    method: 'POST',
    body: { action: 'put', id, data },
  });
}

/**
 * 删除文章 (供 single.vue 使用)
 */
export async function deleteArticle(id: string): Promise<void> {
  await $fetch('/api/store/article', {
    method: 'POST',
    body: { action: 'delete', id },
  });
}
