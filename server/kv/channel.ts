import { ChannelConfig } from '~/types/channel';

/**
 * 保存渠道配置
 * @param email 用户邮箱
 * @param channel 渠道配置
 */
export async function saveChannel(email: string, channel: ChannelConfig): Promise<boolean> {
  const kv = useStorage('kv');
  await kv.set<ChannelConfig>(`channels:${email}:${channel.id}`, channel);
  return true;
}

/**
 * 获取渠道列表
 * @param email
 */
export async function getChannelList(email: string): Promise<ChannelConfig[]> {
  const kv = useStorage('kv');
  const keys = await kv.getKeys(`channels:${email}`);
  const items = await kv.getItems(keys);
  return items.map(item => item.value as ChannelConfig);
}

// 删除配置
export async function deleteChannel(email: string, channelId: string): Promise<boolean> {
  const kv = useStorage('kv');
  const key = `channels:${email}:${channelId}`;

  if (!(await kv.has(key))) {
    return false;
  }

  await kv.remove(key);
  return true;
}
