import { openDatabase } from './db';

export interface HtmlAsset {
  url: string;
  file: Blob;
  title: string;
  commentID: string | null;
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateHtmlCache(html: HtmlAsset): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('html', 'readwrite').objectStore('html').put(html);
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
export async function getHtmlCache(url: string): Promise<HtmlAsset | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('html').objectStore('html').get(url);
    request.onsuccess = () => {
      const asset: HtmlAsset | undefined = request.result;
      resolve(asset);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
