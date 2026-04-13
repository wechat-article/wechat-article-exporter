export interface MpAccount {
  fakeid: string;
  completed: boolean;
  count: number;
  articles: number;
  nickname?: string;
  round_head_img?: string;
  service_type?: number;
  is_semiconductor?: number;
  total_count: number;
  create_time?: number;
  update_time?: number;
  last_update_time?: number;
}

/**
 * 更新 account 缓存
 */
export async function updateInfoCache(mpAccount: MpAccount): Promise<boolean> {
  await $fetch('/api/store/info', {
    method: 'POST',
    body: { action: 'update', mpAccount },
  });
  return true;
}

export async function updateLastUpdateTime(fakeid: string): Promise<boolean> {
  await $fetch('/api/store/info', {
    method: 'POST',
    body: { action: 'updateLastTime', fakeid },
  });
  return true;
}

/**
 * 获取 info 缓存
 */
export async function getInfoCache(fakeid: string): Promise<MpAccount | undefined> {
  const res = await $fetch<MpAccount | null>('/api/store/info', {
    query: { action: 'get', fakeid },
  });
  return res || undefined;
}

export async function getAllInfo(): Promise<MpAccount[]> {
  return await $fetch<MpAccount[]>('/api/store/info', {
    query: { action: 'all' },
  });
}

export async function getAccountNameByFakeid(fakeid: string): Promise<string | null> {
  return await $fetch<string | null>('/api/store/info', {
    query: { action: 'accountName', fakeid },
  });
}

export async function importMpAccounts(mpAccounts: MpAccount[]): Promise<void> {
  await $fetch('/api/store/info', {
    method: 'POST',
    body: { action: 'import', mpAccounts },
  });
}
