import { type CookieEntity } from '~/server/utils/CookieStore';

export type CookieKVKey = string;

// 会话过期时间（毫秒）：4天
const SESSION_TTL_MS = 60 * 60 * 24 * 4 * 1000;

export interface CookieKVValue {
  token: string;
  cookies: CookieEntity[];
  ownerId?: string;  // 登录账号标识 (nick_name 的 MD5 哈希)
  createdAt?: number; // 会话创建时间戳（毫秒）
}

export async function setMpCookie(key: CookieKVKey, data: CookieKVValue): Promise<boolean> {
  const kv = useStorage('kv');
  try {
    // 添加创建时间（如果不存在）
    const dataWithTimestamp: CookieKVValue = {
      ...data,
      createdAt: data.createdAt ?? Date.now(),
    };
    await kv.set<CookieKVValue>(`cookie:${key}`, dataWithTimestamp, {
      // https://developers.cloudflare.com/kv/api/write-key-value-pairs/#expiring-keys
      // 注意：只有 Cloudflare KV 驱动支持此选项，fs 驱动会忽略
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
  const data = await kv.get<CookieKVValue>(`cookie:${key}`);

  if (!data) return null;

  // 检查会话是否已过期（针对 fs 驱动等不支持 TTL 的存储）
  if (data.createdAt) {
    const elapsed = Date.now() - data.createdAt;
    if (elapsed > SESSION_TTL_MS) {
      // 会话已过期，删除并返回 null
      console.log(`Session expired for key ${key}, elapsed: ${Math.round(elapsed / 1000 / 60 / 60)} hours`);
      await kv.remove(`cookie:${key}`);
      return null;
    }
  }

  return data;
}

