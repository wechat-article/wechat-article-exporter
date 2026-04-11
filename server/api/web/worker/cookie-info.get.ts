import { getPool } from '~/server/db/postgres';
import { getAuthKeyFromRequest } from '~/server/utils/proxy-request';

/**
 * GET /api/web/worker/cookie-info
 *
 * 返回当前请求绑定的 session 过期时间（用于前端自动刷新登录信息过期显示）
 */
export default defineEventHandler(async (event) => {
  const authKey = getAuthKeyFromRequest(event);
  if (!authKey) {
    return { valid: false, expiresAt: null };
  }

  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  const res = await pool.query(
    `SELECT expires_at FROM session WHERE auth_key = $1 AND expires_at > $2 LIMIT 1`,
    [authKey, now]
  );

  if (res.rows.length === 0) {
    return { valid: false, expiresAt: null };
  }

  const expiresAt = res.rows[0].expires_at;
  return { valid: true, expiresAt: expiresAt * 1000 }; // 返回毫秒时间戳
});
