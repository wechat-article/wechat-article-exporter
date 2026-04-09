import { getPool } from '~/server/db/postgres';

/**
 * GET /api/preferences — 获取偏好设置
 * POST /api/preferences — 保存偏好设置
 *
 * 数据格式与原 localStorage 中 'preferences' 键存储的 JSON 完全一致
 */
export default defineEventHandler(async (event) => {
  const pool = getPool();
  const method = getMethod(event);

  if (method === 'GET') {
    const res = await pool.query(`SELECT data FROM preferences WHERE id = 'default'`);
    if (res.rows.length > 0) {
      return res.rows[0].data;
    }
    // 无记录时返回 null，由客户端使用默认值
    return null;
  }

  if (method === 'POST') {
    const body = await readBody(event);
    console.log('[preferences API] 收到 POST 请求，body 类型:', typeof body, '，privateProxyList:', body?.privateProxyList, '\n完整 body:', JSON.stringify(body)?.slice(0, 500));
    if (!body || typeof body !== 'object') {
      console.error('[preferences API] body 无效:', body);
      throw createError({ statusCode: 400, message: '请求体必须是 JSON 对象' });
    }
    const now = Date.now();
    await pool.query(
      `INSERT INTO preferences (id, data, update_time) VALUES ('default', $1, $2)
       ON CONFLICT (id) DO UPDATE SET data = $1, update_time = $2`,
      [JSON.stringify(body), now],
    );
    console.log('[preferences API] 保存成功');
    return { success: true };
  }

  throw createError({ statusCode: 405, message: 'Method not allowed' });
});
