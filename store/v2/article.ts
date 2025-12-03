import type { AppMsgExWithFakeID, PublishInfo, PublishPage } from '~/types/types';
import { db } from './db';
import { type Info, updateInfoCache } from './info';

export type ArticleAsset = AppMsgExWithFakeID;

/**
 * 更新文章缓存
 * @param account
 * @param publish_page
 */
export async function updateArticleCache(account: Info, publish_page: PublishPage) {
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
      hidden: account.hidden,
    });
  });
}

/**
 * 检查是否存在指定时间之前的缓存
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function hitCache(fakeid: string, create_time: number): Promise<boolean> {
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
  return db.article
    .where('fakeid')
    .equals(fakeid)
    .and(article => article.create_time < create_time)
    .reverse()
    .sortBy('create_time');
}

/**
 * 检查是否存在同标题且发布时间（精确到小时）相同的文章
 * @param fakeid
 * @param title
 * @param create_time
 */
export async function articleExistsByTitleAndTime(
  fakeid: string,
  title: string,
  create_time: number
): Promise<boolean> {
  const hourBucket = Math.floor(create_time / 3600);
  const count = await db.article
    .where('fakeid')
    .equals(fakeid)
    .filter(a => {
      if (!a.title) return false;
      const aHourBucket = Math.floor((a.create_time || 0) / 3600);
      return a.title === title && aHourBucket === hourBucket;
    })
    .count();
  return count > 0;
}

/**
 * 检查当前文章的link是否已经存在
 * @param link
 * @returns
 */
export async function articleExistsByLink(link: string): Promise<boolean> {
  const url = new URL(link);
  const biz = url.searchParams.get('__biz');
  const mid = url.searchParams.get('mid');
  const sn = url.searchParams.get('sn');
  if (!biz || !mid || !sn) {
    // fallback to full link match
    const count = await db.article.where('link').equals(link).count();
    return count > 0;
  }
  const count = await db.article
    .filter(a => {
      try {
        const u = new URL(a.link);
        return (
          u.searchParams.get('__biz') === biz && u.searchParams.get('mid') === mid && u.searchParams.get('sn') === sn
        );
      } catch {
        return false;
      }
    })
    .count();
  return count > 0;
}

/**
 * 根据 url 获取文章对象
 * @param url
 */
export async function getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
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
  db.transaction('rw', 'article', async () => {
    db.article
      .where('link')
      .equals(url)
      .modify(article => {
        article.is_deleted = true;
      });
  });
}
