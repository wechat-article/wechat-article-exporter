import { openDatabase } from './db';
import type { ArticleMetadata } from '~/utils/download/types';

export type Metadata = ArticleMetadata & {
  url: string;
  title: string;
};

/**
 * 更新 metadata
 * @param metadata
 */
export async function updateMetadataCache(metadata: Metadata): Promise<boolean> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('metadata', 'readwrite').objectStore('metadata').put(metadata);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

/**
 * 获取 metadata
 * @param url
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('metadata').objectStore('metadata').get(url);
    request.onsuccess = () => {
      const metadata: Metadata | undefined = request.result;
      resolve(metadata);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
