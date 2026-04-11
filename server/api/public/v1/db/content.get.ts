import {
  isSupportedArticleContentFormat,
  resolveArticleContent,
  validateArticleUrl,
} from '~/server/utils/article-content';

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