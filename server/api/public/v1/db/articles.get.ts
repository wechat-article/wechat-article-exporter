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

interface ArticleListQuery {
  fakeid: string;
  page?: string;
  size?: string;
}

export default defineEventHandler(async (event) => {
  const query = getQuery<ArticleListQuery>(event);
  if (!query.fakeid) {
    return failure('fakeid不能为空');
  }

  const page = Math.max(1, Number(query.page || 1) || 1);
  const size = Math.min(100, Math.max(1, Number(query.size || 20) || 20));
  const offset = (page - 1) * size;

  try {
    const pool = getPool();
    const totalRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM article
       WHERE fakeid = $1 AND link IS NOT NULL`,
      [query.fakeid]
    );
    const total = Number(totalRes.rows[0]?.total || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / size);

    const listRes = await pool.query(
      `SELECT
         link,
         COALESCE(update_time, create_time) AS update_time,
         COALESCE(NULLIF(article_title, ''), data->>'title') AS article_title
       FROM article
       WHERE fakeid = $1 AND link IS NOT NULL
       ORDER BY COALESCE(update_time, create_time) DESC, id DESC
       LIMIT $2 OFFSET $3`,
      [query.fakeid, size, offset]
    );

    const list = listRes.rows.map((row: any) => ({
      link: row.link,
      update_time: Number(row.update_time || 0),
      article_title: row.article_title || '',
    }));

    return success({
      list,
      pagination: {
        page,
        size,
        total,
        total_pages: totalPages,
        has_next: totalPages > 0 && page < totalPages,
        has_prev: page > 1,
      },
    });
  } catch (error: any) {
    return failure(error?.message || '查询文章列表失败');
  }
});