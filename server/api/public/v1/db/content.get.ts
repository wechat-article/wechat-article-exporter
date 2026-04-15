import {
  isSupportedArticleContentFormat,
  resolveArticleContent,
  validateArticleUrl,
} from '~/server/utils/article-content';
import { getPool } from '~/server/db/postgres';

function failure(message: string) {
  return {
    base_resp: {
      ret: -1,
      err_msg: message,
    },
  };
}

interface ContentQuery {
  url: string;
  format?: string;
}

export default defineEventHandler(async (event) => {
  const query = getQuery<ContentQuery>(event);
  if (!query.url) {
    return failure('url不能为空');
  }

  const url = decodeURIComponent(query.url.trim());
  if (!validateArticleUrl(url)) {
    return failure('url不合法');
  }

  const format = (query.format || 'html').toLowerCase();
  if (!isSupportedArticleContentFormat(format)) {
    return failure('不支持的format');
  }

  try {
    const pool = getPool();
    const disabledAccountRes = await pool.query(
      `SELECT 1
       FROM article AS article
       INNER JOIN info AS info ON info.fakeid = article.fakeid
       WHERE article.link = $1
         AND COALESCE(info.is_delete, FALSE) = TRUE
       LIMIT 1`,
      [url],
    );
    if (disabledAccountRes.rows.length > 0) {
      return failure('该公众号已被禁用');
    }

    const result = await resolveArticleContent(url, format);
    if (format === 'json') {
      return result.content;
    }

    return new Response(result.content as string, {
      status: 200,
      headers: {
        'Content-Type': result.contentType,
      },
    });
  } catch (error: any) {
    return failure(error?.message || '获取文章内容失败，请重试');
  }
});