import type { ArticleMetadata } from '~/utils/download/types';

export type Metadata = ArticleMetadata & {
  fakeid: string;
  url: string;
  title: string;
};

/**
 * 更新 metadata
 */
export async function updateMetadataCache(metadata: Metadata): Promise<boolean> {
  await $fetch('/api/store/metadata', {
    method: 'POST',
    body: { action: 'update', metadata },
  });
  return true;
}

/**
 * 获取 metadata
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
  const res = await $fetch<Metadata | null>('/api/store/metadata', {
    query: { action: 'get', url },
  });
  return res || undefined;
}
