import { db } from './db';

// 检查是否使用 MySQL 后端
function useMySQLBackend(): boolean {
  if (typeof window !== 'undefined') {
    // 客户端：检查 runtime config
    try {
      const config = useRuntimeConfig();
      return config.public.useMysql === true;
    } catch {
      return false;
    }
  }
  return false;
}

// 删除公众号数据
export async function deleteAccountData(ids: string[]): Promise<void> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    await $fetch(`/api/db/account/${ids.join(',')}`, {
      method: 'DELETE',
    });
    return;
  }

  // 否则使用 IndexedDB
  return db.transaction(
    'rw',
    [
      'api',
      'article',
      'asset',
      'comment',
      'comment_reply',
      'debug',
      'html',
      'info',
      'metadata',
      'resource',
      'resource-map',
    ],
    async () => {
      db.api.toCollection().delete();
      db.article.where('fakeid').anyOf(ids).delete();
      db.asset.where('fakeid').anyOf(ids).delete();
      db.comment.where('fakeid').anyOf(ids).delete();
      db.comment_reply.where('fakeid').anyOf(ids).delete();
      db.debug.where('fakeid').anyOf(ids).delete();
      db.html.where('fakeid').anyOf(ids).delete();
      db.info.where('fakeid').anyOf(ids).delete();
      db.metadata.where('fakeid').anyOf(ids).delete();
      db.resource.where('fakeid').anyOf(ids).delete();
      db['resource-map'].where('fakeid').anyOf(ids).delete();
    }
  );
}

// 导出 MySQL 后端检查函数
export { useMySQLBackend };
