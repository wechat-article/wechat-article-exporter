import type { ArticleMetadata } from '~/utils/download/types';
import { db } from './db';
import { useMySQLBackend } from './index';

export type Metadata = ArticleMetadata & {
  fakeid: string;
  url: string;
  title: string;
};

/**
 * 更新 metadata
 * @param metadata
 */
export async function updateMetadataCache(metadata: Metadata): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'metadata', action: 'set', data: metadata },
    });
    return true;
  }

  return db.transaction('rw', 'metadata', () => {
    db.metadata.put(metadata);
    return true;
  });
}

/**
 * 获取 metadata
 * @param url
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: Metadata }>('/api/db/data', {
        method: 'POST',
        body: { table: 'metadata', action: 'get', key: url },
      });
      return result.code === 0 ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  return db.metadata.get(url);
}
