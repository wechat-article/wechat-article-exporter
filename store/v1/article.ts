import type { AppMsgEx, PublishInfo, PublishListItem } from '~/types/types';
import { openDatabase } from './db';
import { updateInfoCache } from './info';

const activeAccount = useActiveAccount();

async function updateArticle(articleStore: IDBObjectStore, article: AppMsgEx, fakeid: string): Promise<IDBValidKey> {
  const key = `${fakeid}:${article.aid}`;

  return new Promise((resolve, reject) => {
    const request = articleStore.put({ ...article, fakeid }, key);
    request.onsuccess = () => {
      resolve(request.result);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

function getAllKeys(store: IDBObjectStore): Promise<IDBValidKey[]> {
  const request = store.getAllKeys();
  return new Promise((resolve, reject) => {
    request.onsuccess = evt => {
      resolve(request.result);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 更新文章缓存
 * @param publishList 本次获取的文章列表
 * @param completed 是否已全部加载
 * @param fakeid 公众号id
 */
export async function updateArticleCache(publishList: PublishListItem[], completed: boolean, fakeid: string) {
  const db = await openDatabase();
  const tx = db.transaction(['article', 'info'], 'readwrite');

  const articleStore = tx.objectStore('article');
  const infoStore = tx.objectStore('info');

  // 存储前所有的key
  const keys = await getAllKeys(articleStore);

  // 统计本次缓存成功新增的数量
  let msgCount = 0;
  let articleCount = 0;

  for (const item of publishList) {
    const publish_info: PublishInfo = JSON.parse(item.publish_info);
    let newEntryCount = 0;

    for (const article of publish_info.appmsgex) {
      const key = await updateArticle(articleStore, article, fakeid);
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

  await updateInfoCache(infoStore, {
    fakeid: fakeid,
    completed: completed,
    count: msgCount,
    articles: articleCount,
    nickname: activeAccount.value?.nickname,
    round_head_img: activeAccount.value?.type === 'author' ? undefined : activeAccount.value?.round_head_img,
  });
}

/**
 * 检查是否存在指定时间之前的缓存
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function hitCache(fakeid: string, create_time: number): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const index = db.transaction('article').objectStore('article').index('fakeid_create_time');
    const range = IDBKeyRange.bound([fakeid], [fakeid, create_time], false, true);

    const request = index.openCursor(range);
    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        resolve(true);
      } else {
        resolve(false);
      }
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 读取缓存中的指定时间之前的历史文章
 * @param fakeid 公众号id
 * @param create_time 创建时间
 */
export async function getArticleCache(fakeid: string, create_time: number): Promise<AppMsgEx[]> {
  const db = await openDatabase();
  const articles: AppMsgEx[] = [];

  return new Promise((resolve, reject) => {
    const index = db.transaction('article').objectStore('article').index('fakeid_create_time');

    // 采用复合索引，参考:
    // 1. https://stackoverflow.com/questions/31403945/how-to-create-a-query-with-multiple-conditions-in-indexeddb
    // 2. https://blog.csdn.net/weixin_35482237/article/details/117864024

    const range = IDBKeyRange.bound([fakeid], [fakeid, create_time], false, true);
    const request = index.openCursor(range, 'prev');

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        articles.push(cursor.value);
        cursor.continue();
      } else {
        // done
        resolve(articles);
      }
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 根据 url 获取文章对象
 * @param url
 */
export async function getArticleByLink(url: string): Promise<AppMsgEx & { fakeid: string }> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const index = db.transaction('article').objectStore('article').index('link');
    const request = index.get(url);
    request.onsuccess = event => {
      resolve(request.result);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 文章被删除
 * @param fakeid
 * @param url
 */
export async function articleDeleted(fakeid: string, url: string): Promise<void> {
  const article = await getArticleByLink(url);
  if (article) {
    article.is_deleted = true;
  }

  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db
      .transaction('article', 'readwrite')
      .objectStore('article')
      .put(article, `${fakeid}:${article.aid}`);
    request.onsuccess = event => {
      resolve();
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
