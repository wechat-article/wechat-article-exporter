import type { AppMsgExWithFakeID, PublishInfo, PublishPage } from '~/types/types';
import { db } from './db';
import { type Info, updateInfoCache } from './info';
import { useMySQLBackend } from './index';

export type ArticleAsset = AppMsgExWithFakeID;

/**
 * 更新文章缓存
 * @param account
 * @param publish_page
 */
export async function updateArticleCache(account: Info, publish_page: PublishPage) {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch('/api/db/article', {
      method: 'POST',
      body: { account, publishPage: publish_page },
    });
    return;
  }

  // 使用 IndexedDB
  db.transaction('rw', ['article', 'info'], async () => {
    const keys = await db.article.toCollection().keys();

    const fakeid = account.fakeid;
    const total_count = publish_page.total_count;
    const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);

    // 统计本次缓存成功新增的数量
    let msgCount = 0;
    let articleCount = 0;

    for (const item of publish_list) {
      const publish_info: PublishInfo = JSON.parse(item.publish_info);
      let newEntryCount = 0;

      for (const article of publish_info.appmsgex) {
        const key = await db.article.put({ ...article, fakeid }, `${fakeid}:${article.aid}`);
        if (!keys.includes(key)) {
          newEntryCount++;
          articleCount++;
        }
      }

      if (newEntryCount > 0) {
        // 新增成功
        msgCount++;
      }
    }

    await updateInfoCache({
      fakeid: fakeid,
      completed: publish_list.length === 0,
      count: msgCount,
      articles: articleCount,
      nickname: account.nickname,
      round_head_img: account.round_head_img,
      total_count: total_count,
    });
  });
}

/**
 * 检查是否存在指定时间之前的缓存
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function hitCache(fakeid: string, create_time: number): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: { hit: boolean } }>(
        `/api/db/article/hit-cache?fakeid=${fakeid}&createTime=${create_time}`
      );
      return result.code === 0 ? result.data.hit : false;
    } catch {
      return false;
    }
  }

  const count = await db.article
    .where('fakeid')
    .equals(fakeid)
    .and(article => article.create_time < create_time)
    .count();
  return count > 0;
}

/**
 * 读取缓存中的指定时间之前的历史文章
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function getArticleCache(fakeid: string, create_time: number): Promise<AppMsgExWithFakeID[]> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: AppMsgExWithFakeID[] }>(
        `/api/db/article?fakeid=${fakeid}&createTime=${create_time}`
      );
      return result.code === 0 ? result.data : [];
    } catch {
      return [];
    }
  }

  return db.article
    .where('fakeid')
    .equals(fakeid)
    .and(article => article.create_time < create_time)
    .reverse()
    .sortBy('create_time');
}

/**
 * 根据 url 获取文章对象
 * @param url
 */
export async function getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    const result = await $fetch<{ code: number; data: AppMsgExWithFakeID }>(
      `/api/db/article/${encodeURIComponent(url)}?byLink=true`
    );
    if (result.code !== 0 || !result.data) {
      throw new Error(`Article(${url}) does not exist`);
    }
    return result.data;
  }

  const article = await db.article.where('link').equals(url).first();
  if (!article) {
    throw new Error(`Article(${url}) does not exist`);
  }
  return article;
}

/**
 * 文章被删除
 * @param url
 */
export async function articleDeleted(url: string): Promise<void> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch(`/api/db/article/${encodeURIComponent(url)}`, {
      method: 'DELETE',
    });
    return;
  }

  db.transaction('rw', 'article', async () => {
    db.article
      .where('link')
      .equals(url)
      .modify(article => {
        article.is_deleted = true;
      });
  });
}
