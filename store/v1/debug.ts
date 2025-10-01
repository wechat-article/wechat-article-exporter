import { openDatabase } from './db';

export interface HtmlAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateDebugCache(html: HtmlAsset): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('debug', 'readwrite').objectStore('debug').put(html);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getDebugCache(url: string): Promise<HtmlAsset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('debug').objectStore('debug').get(url);
    request.onsuccess = () => {
      const asset: HtmlAsset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

export async function getDebugInfo(): Promise<HtmlAsset[]> {
  const db = await openDatabase();
  const records: HtmlAsset[] = [];

  return new Promise((resolve, reject) => {
    const objectStore = db.transaction('debug').objectStore('debug');
    const request = objectStore.openCursor();

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        records.push(cursor.value);
        cursor.continue();
      } else {
        resolve(records);
      }
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
