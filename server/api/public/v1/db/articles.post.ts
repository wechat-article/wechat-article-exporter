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

interface ArticleListBody {
  fakeid?: string | string[];
  fakeids?: string[];
  page?: number | string;
  size?: number | string;
  start_time?: number | string;
  end_time?: number | string;
}

function normalizeFakeids(body: ArticleListBody): string[] {
  const values = [
    ...(Array.isArray(body.fakeids) ? body.fakeids : []),
    ...(Array.isArray(body.fakeid) ? body.fakeid : body.fakeid ? [body.fakeid] : []),
  ];

  return Array.from(
    new Set(
      values
        .map(value => (typeof value === 'string' ? value.trim() : ''))
        .filter(Boolean)
    )
  );
}

export default defineEventHandler(async (event) => {
  const body = await readBody<ArticleListBody>(event);
  const fakeids = normalizeFakeids(body || {});
  if (fakeids.length === 0) {
    return failure('fakeids不能为空');
  }

  const page = Math.max(1, Number(body?.page || 1) || 1);
  const size = Math.min(100, Math.max(1, Number(body?.size || 20) || 20));
  const startTimeRaw = body?.start_time;
  const endTimeRaw = body?.end_time;
  const startTime = startTimeRaw === undefined || startTimeRaw === '' ? null : Number(startTimeRaw);
  const endTime = endTimeRaw === undefined || endTimeRaw === '' ? null : Number(endTimeRaw);
  const offset = (page - 1) * size;

  if (startTime !== null && (!Number.isFinite(startTime) || startTime < 0)) {
    return failure('start_time不合法');
  }

  if (endTime !== null && (!Number.isFinite(endTime) || endTime < 0)) {
    return failure('end_time不合法');
  }

  if (startTime !== null && endTime !== null && startTime > endTime) {
    return failure('start_time不能大于end_time');
  }

  try {
    const pool = getPool();
    const totalRes = await pool.query(
      `SELECT COUNT(*) AS total
       FROM article
       WHERE fakeid = ANY($1::text[])
         AND link IS NOT NULL
         AND ($2::bigint IS NULL OR update_time >= $2)
         AND ($3::bigint IS NULL OR update_time <= $3)`,
      [fakeids, startTime, endTime]
    );
    const total = Number(totalRes.rows[0]?.total || 0);
    const totalPages = total === 0 ? 0 : Math.ceil(total / size);

    const listRes = await pool.query(
      `SELECT
         fakeid,
         link,
         COALESCE(update_time, create_time) AS update_time,
         COALESCE(NULLIF(article_title, ''), data->>'title') AS article_title,
         COALESCE(
           NULLIF(cover, ''),
           NULLIF(data->>'cover', ''),
           NULLIF(data->>'cover_img', ''),
           NULLIF(data->>'pic_cdn_url_235_1', ''),
           NULLIF(data->>'pic_cdn_url_16_9', ''),
           NULLIF(data->>'pic_cdn_url_3_4', ''),
           NULLIF(data->>'pic_cdn_url_1_1', '')
         ) AS cover,
         COALESCE(NULLIF(digest, ''), NULLIF(data->>'digest', '')) AS digest,
         COALESCE(
           is_deleted,
           CASE
             WHEN LOWER(COALESCE(data->>'is_deleted', '')) IN ('true', '1') THEN TRUE
             WHEN LOWER(COALESCE(data->>'is_deleted', '')) IN ('false', '0') THEN FALSE
             ELSE FALSE
           END
         ) AS is_deleted
       FROM article
       WHERE fakeid = ANY($1::text[])
         AND link IS NOT NULL
         AND ($2::bigint IS NULL OR update_time >= $2)
         AND ($3::bigint IS NULL OR update_time <= $3)
       ORDER BY COALESCE(update_time, create_time) DESC, id DESC
       LIMIT $4 OFFSET $5`,
      [fakeids, startTime, endTime, size, offset]
    );

    const list = listRes.rows.map((row: any) => ({
      fakeid: row.fakeid,
      link: row.link,
      update_time: Number(row.update_time || 0),
      article_title: row.article_title || '',
      cover: row.cover || '',
      digest: row.digest || '',
      is_deleted: row.is_deleted === true,
    }));

    return success({
      fakeids,
      filters: {
        start_time: startTime,
        end_time: endTime,
      },
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