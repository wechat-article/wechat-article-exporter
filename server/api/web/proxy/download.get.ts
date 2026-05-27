import {
  buildDownloadProxyHeaders,
  buildDownloadProxyResponseHeaders,
  validateDownloadTargetUrl,
} from '~/server/utils/download-proxy';

interface DownloadProxyQuery {
  url?: string;
  headers?: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<DownloadProxyQuery>(event);
  if (!query.url) {
    throw createError({
      statusCode: 400,
      statusMessage: 'url 不能为空',
    });
  }

  const targetUrl = validateDownloadTargetUrl(query.url);
  const requestHeaders = buildDownloadProxyHeaders(query.headers);

  let upstreamResponse: Response;
  try {
    upstreamResponse = await fetch(targetUrl, {
      headers: requestHeaders,
      redirect: 'follow',
    });
  } catch (error) {
    throw createError({
      statusCode: 502,
      statusMessage: '下载代理请求失败',
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return new Response(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: buildDownloadProxyResponseHeaders(upstreamResponse.headers),
  });
});
