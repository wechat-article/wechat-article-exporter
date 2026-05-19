import { createError } from 'h3';
import { USER_AGENT } from '../../config';

const ALLOWED_DOWNLOAD_HOSTS = new Set([
  'mp.weixin.qq.com',
  'mmbiz.qpic.cn',
  'mmbiz.qlogo.cn',
  'wx.qlogo.cn',
  'res.wx.qq.com',
  'wxa.wxs.qq.com',
]);

export function normalizeDownloadTargetUrl(url: string): URL {
  const trimmed = url.trim();
  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed;
  return new URL(normalized);
}

export function validateDownloadTargetUrl(url: string): URL {
  const targetUrl = normalizeDownloadTargetUrl(url);

  if (!['http:', 'https:'].includes(targetUrl.protocol)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '只支持 HTTP/HTTPS 下载链接',
    });
  }

  if (!ALLOWED_DOWNLOAD_HOSTS.has(targetUrl.hostname)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: `不允许代理该域名: ${targetUrl.hostname}`,
    });
  }

  return targetUrl;
}

export function buildDownloadProxyHeaders(headersParam?: string): Headers {
  const headers = new Headers({
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    Referer: 'https://mp.weixin.qq.com/',
    Origin: 'https://mp.weixin.qq.com',
    'User-Agent': USER_AGENT,
  });

  if (!headersParam) {
    return headers;
  }

  try {
    const customHeaders = JSON.parse(headersParam) as Record<string, string>;
    for (const [key, value] of Object.entries(customHeaders)) {
      if (!value) {
        continue;
      }
      if (key.toLowerCase() === 'cookie') {
        headers.set('Cookie', value);
      }
    }
  } catch {
    // Ignore malformed optional headers and keep the default request headers.
  }

  return headers;
}

export function buildDownloadProxyResponseHeaders(upstreamHeaders: Headers): Headers {
  const headers = new Headers();
  const contentType = upstreamHeaders.get('content-type');
  const cacheControl = upstreamHeaders.get('cache-control');
  const etag = upstreamHeaders.get('etag');
  const lastModified = upstreamHeaders.get('last-modified');

  headers.set('Access-Control-Allow-Origin', '*');
  if (contentType) headers.set('Content-Type', contentType);
  if (cacheControl) headers.set('Cache-Control', cacheControl);
  if (etag) headers.set('ETag', etag);
  if (lastModified) headers.set('Last-Modified', lastModified);

  return headers;
}
