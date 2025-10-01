import { SubscribeSourceConfig } from '~/types/source';

/**
 * 保存订阅源配置
 * @param email 用户邮箱
 * @param config 订阅源配置
 */
export async function saveSource(email: string, config: SubscribeSourceConfig): Promise<boolean> {
  const kv = useStorage('kv');
  await kv.set<SubscribeSourceConfig>(`sources:${email}:${config.id}`, config);
  return true;
}

/**
 * 获取订阅源列表
 * @param email
 */
export async function getSourceList(email: string): Promise<SubscribeSourceConfig[]> {
  const kv = useStorage('kv');
  const keys = await kv.getKeys(`sources:${email}`);
  const items = await kv.getItems(keys);
  return items.map(item => item.value as SubscribeSourceConfig);
}

// 删除配置
export async function deleteSource(email: string, sourceId: string): Promise<boolean> {
  const kv = useStorage('kv');
  const key = `sources:${email}:${sourceId}`;

  if (!(await kv.has(key))) {
    return false;
  }

  await kv.remove(key);
  return true;
}

export async function getAllSource(): Promise<SubscribeSourceConfig[]> {
  const kv = useStorage('kv');
  const keys = await kv.getKeys('sources');
  const items = await kv.getItems(keys);
  return items.map(item => item.value as SubscribeSourceConfig);
}
