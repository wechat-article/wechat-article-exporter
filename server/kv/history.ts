// 推送历史记录
interface PushHistoryEntry {
  // 推送目标用户
  email: string;

  // 推送公众号id
  fakeid: string;

  // 推送的最新文章的时间
  lastMessageTime: number;

  // 记录时间
  updateTime: number;
}

/**
 * 更新条目
 */
export async function updateHistory(entry: PushHistoryEntry): Promise<boolean> {
  const kv = useStorage('kv');
  await kv.set<PushHistoryEntry>(`history:${entry.email}:${entry.fakeid}`, entry);
  return true;
}

/**
 * 获取条目
 */
export async function getHistory(email: string): Promise<PushHistoryEntry[]> {
  const kv = useStorage('kv');
  const keys = await kv.getKeys(`history:${email}`);
  const items = await kv.getItems(keys);
  return items.map(item => item.value as PushHistoryEntry);
}
