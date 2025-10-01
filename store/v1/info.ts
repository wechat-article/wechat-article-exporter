import { openDatabase } from './db';

export interface Info {
  fakeid: string;
  completed: boolean;
  count: number;
  articles: number;

  // 公众号昵称
  nickname?: string;
  // 公众号头像
  round_head_img?: string;
}

/**
 * 更新 info 缓存
 * @param infoStore
 * @param info
 */
export async function updateInfoCache(infoStore: IDBObjectStore, info: Info): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const request = infoStore.get(info.fakeid);
    request.onsuccess = () => {
      let infoCache: Info | undefined = request.result;
      if (infoCache) {
        if (info.completed) {
          infoCache.completed = info.completed;
        }
        infoCache.count += info.count;
        infoCache.articles += info.articles;
        infoCache.nickname = info.nickname;
        infoCache.round_head_img = info.round_head_img;
      } else {
        infoCache = {
          fakeid: info.fakeid,
          completed: info.completed,
          count: info.count,
          articles: info.articles,
          nickname: info.nickname,
          round_head_img: info.round_head_img,
        };
      }

      const updateRequest = infoStore.put(infoCache);
      updateRequest.onsuccess = () => {
        resolve(true);
      };
      updateRequest.onerror = evt => {
        reject(evt);
      };
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 info 缓存
 * @param fakeid
 */
export async function getInfoCache(fakeid: string): Promise<Info | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('info').objectStore('info').get(fakeid);
    request.onsuccess = () => {
      const info: Info | undefined = request.result;
      resolve(info);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

export async function getAllInfo(): Promise<Info[]> {
  const db = await openDatabase();
  const infos: Info[] = [];

  return new Promise((resolve, reject) => {
    const store = db.transaction('info').objectStore('info');
    const request = store.openCursor();
    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        infos.push(cursor.value);
        cursor.continue();
      } else {
        resolve(infos);
      }
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
