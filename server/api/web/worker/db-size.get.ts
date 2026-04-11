import { getPool } from '~/server/db/postgres';

/**
 * GET /api/web/worker/db-size
 *
 * 返回 PostgreSQL 数据库占用空间大小（字节）
 */
export default defineEventHandler(async () => {
  const pool = getPool();
  const res = await pool.query(`SELECT pg_database_size(current_database()) AS size`);
  const bytes = Number(res.rows[0].size);
  return { bytes };
});
