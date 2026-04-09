import { getPool } from '~/server/db/postgres';
import type { Preferences } from '~/types/preferences';

/**
 * 从数据库读取偏好设置（服务端专用）
 * 返回 null 表示尚未保存过（使用默认值）
 */
export async function getPreferencesFromDB(): Promise<Preferences | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT data FROM preferences WHERE id = 'default'`);
  if (res.rows.length > 0) {
    return res.rows[0].data as Preferences;
  }
  return null;
}
