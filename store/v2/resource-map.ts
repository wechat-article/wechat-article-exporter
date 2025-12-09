import { db } from './db';
import { useMySQLBackend } from './index';

export interface ResourceMapAsset {
  fakeid: string;
  url: string;
  resources: string[];
}

/**
 * 更新 resource-map 缓存
 * @param resourceMap 缓存
 */
export async function updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'resource_map', action: 'set', data: resourceMap },
    });
    return true;
  }

  return db.transaction('rw', 'resource-map', () => {
    db['resource-map'].put(resourceMap);
    return true;
  });
}

/**
 * 获取 resource-map 缓存
 * @param url
 */
export async function getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: ResourceMapAsset }>('/api/db/data', {
        method: 'POST',
        body: { table: 'resource_map', action: 'get', key: url },
      });
      return result.code === 0 ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  return db['resource-map'].get(url);
}
