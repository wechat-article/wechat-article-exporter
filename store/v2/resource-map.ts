export interface ResourceMapAsset {
  fakeid: string;
  url: string;
  resources: string[];
}

/**
 * 更新 resource-map 缓存
 */
export async function updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean> {
  await $fetch('/api/store/resource-map', {
    method: 'POST',
    body: { action: 'update', resourceMap },
  });
  return true;
}

/**
 * 获取 resource-map 缓存
 */
export async function getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
  const res = await $fetch<ResourceMapAsset | null>('/api/store/resource-map', {
    query: { action: 'get', url },
  });
  return res || undefined;
}
