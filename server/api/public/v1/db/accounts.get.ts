import { getPool } from '~/server/db/postgres';

function success(data: Record<string, any>) {
  return {
    base_resp: {
      ret: 0,
      err_msg: 'ok',
    },
    ...data,
  };
}

function failure(message: string) {
  return {
    base_resp: {
      ret: -1,
      err_msg: message,
    },
  };
}

export default defineEventHandler(async () => {
  try {
    const pool = getPool();
    const res = await pool.query(
      `SELECT nickname, fakeid, round_head_img, service_type, is_semiconductor
       FROM info
       WHERE fakeid IS NOT NULL
       ORDER BY COALESCE(NULLIF(nickname, ''), fakeid) ASC`
    );

    return success({
      list: res.rows,
      total: res.rows.length,
    });
  } catch (error: any) {
    return failure(error?.message || '查询公众号列表失败');
  }
});