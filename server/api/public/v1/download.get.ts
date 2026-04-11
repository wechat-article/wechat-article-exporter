import {
  isSupportedArticleContentFormat,
  resolveArticleContent,
  validateArticleUrl,
} from '~/server/utils/article-content';

interface SearchBizQuery {
  url: string;
  format: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<SearchBizQuery>(event);
  if (!query.url) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url不能为空',
      },
    };
  }

  const url = decodeURIComponent(query.url.trim());
  if (!validateArticleUrl(url)) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url不合法',
      },
    };
  }

  const format = (query.format || 'html').toLowerCase();
  if (!isSupportedArticleContentFormat(format)) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '不支持的format',
      },
    };
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
});
