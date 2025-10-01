import { db } from './db';

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
  return db['resource-map'].get(url);
}
