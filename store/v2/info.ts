import { db } from './db';
import { useMySQLBackend } from './index';

export interface Info {
  fakeid: string;
  completed: boolean;
  count: number;
  articles: number;

  // 公众号昵称
  nickname?: string;
  // 公众号头像
  round_head_img?: string;

  // 公众号文章总数
  total_count: number;
  create_time?: number;
  update_time?: number;

  // 最后更新时间
  last_update_time?: number;
}

/**
 * 更新 info 缓存
 * @param info
 */
export async function updateInfoCache(info: Info): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch(`/api/db/info/${info.fakeid}`, {
      method: 'PUT',
      body: info,
    });
    return true;
  }

  // 使用 IndexedDB
  return db.transaction('rw', 'info', async () => {
    let infoCache = await db.info.get(info.fakeid);
    if (infoCache) {
      if (info.completed) {
        infoCache.completed = info.completed;
      }
      infoCache.count += info.count;
      infoCache.articles += info.articles;
      infoCache.nickname = info.nickname;
      infoCache.round_head_img = info.round_head_img;
      infoCache.total_count = info.total_count;
      infoCache.update_time = Math.round(Date.now() / 1000);
    } else {
      infoCache = {
        fakeid: info.fakeid,
        completed: info.completed,
        count: info.count,
        articles: info.articles,
        nickname: info.nickname,
        round_head_img: info.round_head_img,
        total_count: info.total_count,
        create_time: Math.round(Date.now() / 1000),
        update_time: Math.round(Date.now() / 1000),
      };
    }
    db.info.put(infoCache);
    return true;
  });
}

export async function updateLastUpdateTime(fakeid: string): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch(`/api/db/info/${fakeid}`, {
      method: 'PUT',
      body: { last_update_time: Math.round(Date.now() / 1000) },
    });
    return true;
  }

  return db.transaction('rw', 'info', async () => {
    let infoCache = await db.info.get(fakeid);
    if (infoCache) {
      infoCache.last_update_time = Math.round(Date.now() / 1000);
      db.info.put(infoCache);
    }
    return true;
  });
}

/**
 * 获取 info 缓存
 * @param fakeid
 */
export async function getInfoCache(fakeid: string): Promise<Info | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: Info }>(`/api/db/info/${fakeid}`);
      return result.code === 0 ? result.data : undefined;
    } catch {
      return undefined;
    }
  }

  return db.info.get(fakeid);
}

export async function getAllInfo(): Promise<Info[]> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: Info[] }>('/api/db/info');
      return result.code === 0 ? result.data : [];
    } catch {
      return [];
    }
  }

  return db.info.toArray();
}

// 获取公众号的名称
export async function getAccountNameByFakeid(fakeid: string): Promise<string | null> {
  const account = await getInfoCache(fakeid);
  if (!account) {
    return null;
  }

  return account.nickname || null;
}

// 批量导入公众号
export async function importInfos(infos: Info[]): Promise<void> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch('/api/db/info', {
      method: 'POST',
      body: { infos },
    });
    return;
  }

  for (const info of infos) {
    // 导入时需要把相关数量置空
    info.completed = false;
    info.count = 0;
    info.articles = 0;
    info.total_count = 0;
    info.create_time = undefined;
    info.update_time = undefined;
    info.last_update_time = undefined;
    await updateInfoCache(info);
  }
}
