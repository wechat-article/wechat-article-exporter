import { type StoredSessionRecord } from '../services/api/session-core';

export type CookieKVKey = string;

export type CookieKVValue = StoredSessionRecord;

export async function setMpCookie(key: CookieKVKey, data: CookieKVValue): Promise<boolean> {
  const kv = useStorage('kv');
  try {
    await kv.set<CookieKVValue>(`cookie:${key}`, data, {
      // https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys
      expirationTtl: 60 * 60 * 24 * 4, // 4 days
    });
    return true;
  } catch (err) {
    console.error('kv.set call failed:', err);
    return false;
  }
}

export async function getMpCookie(key: CookieKVKey): Promise<CookieKVValue | null> {
  const kv = useStorage('kv');
  return await kv.get<CookieKVValue>(`cookie:${key}`);
}

export async function deleteMpCookie(key: CookieKVKey): Promise<void> {
  const kv = useStorage('kv');
  await kv.remove(`cookie:${key}`);
}
