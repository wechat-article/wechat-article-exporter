import TurndownService from 'turndown';
import { shouldSkipMpArticleUrl, urlIsValidMpArticle } from '#shared/utils';
import {
  isArticleAccessTooFrequentMessage,
  isPolicyViolationMessage,
  normalizeHtml,
  parseCgiDataNew,
  validateHTMLContent,
} from '#shared/utils/html';
import { RETRY_POLICY, USER_AGENT } from '~/config';
import { getPool } from '~/server/db/postgres';
import {
  isNonRetryableArticleFetchError,
  NonRetryableArticleFetchError,
  notifyArticleAccessTooFrequent,
  waitRandomArticleFetchDelay,
} from '~/server/utils/article-fetch';

export type ArticleContentFormat = 'html' | 'markdown' | 'text' | 'json';

export const SUPPORTED_ARTICLE_CONTENT_FORMATS: ArticleContentFormat[] = ['html', 'markdown', 'text', 'json'];

const UNSUPPORTED_MP_ARTICLE_URL_MESSAGE = '该类 mp/appmsg/show 链接不支持抓取';

export function isSupportedArticleContentFormat(format: string): format is ArticleContentFormat {
  return SUPPORTED_ARTICLE_CONTENT_FORMATS.includes(format as ArticleContentFormat);
}

export function validateArticleUrl(url: string): boolean {
  return urlIsValidMpArticle(url) && !shouldSkipMpArticleUrl(url);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function validateFetchedHtml(html: string): {
  status: 'Success' | 'Deleted' | 'Exception' | 'Error';
  reason: string;
  retryable: boolean;
  notify: boolean;
} {
  const [status, message] = validateHTMLContent(html);
  if (status === 'Deleted') {
    return { status, reason: message || '该内容已被发布者删除', retryable: false, notify: false };
  }
  if (status === 'Exception') {
    if (isPolicyViolationMessage(message)) {
      return { status, reason: message || '此内容因违规无法查看', retryable: false, notify: false };
    }
    if (isArticleAccessTooFrequentMessage(message)) {
      return {
        status,
        reason: message || '访问过于频繁，请用微信扫描二维码进行访问',
        retryable: false,
        notify: true,
      };
    }
    return { status, reason: message || '内容异常', retryable: true, notify: false };
  }
  if (status === 'Error') {
    return { status, reason: '页面结构异常', retryable: true, notify: false };
  }
  return { status, reason: '', retryable: false, notify: false };
}

async function getCachedArticleHtml(url: string): Promise<string | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT file FROM html WHERE url = $1 LIMIT 1`, [url]);
  if (res.rows.length === 0 || !res.rows[0].file) {
    return null;
  }

  return Buffer.from(res.rows[0].file).toString('utf-8');
}

async function fetchRemoteArticleHtml(url: string): Promise<string> {
  await waitRandomArticleFetchDelay(`[article-content] 发起文章抓取 | ${url}`);
  const response = await fetch(url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return await response.text();
}

async function fetchValidatedRemoteArticleHtml(url: string): Promise<string> {
  let lastErrorMessage = '获取文章内容失败，请重试';

  for (let attempt = 0; attempt <= RETRY_POLICY.articleContent.retries; attempt++) {
    if (attempt > 0) {
      console.warn(`[article-content] 正在重试抓取文章，第 ${attempt}/${RETRY_POLICY.articleContent.retries} 次 | ${url}`);
      await delay(RETRY_POLICY.articleContent.delayMs);
    }

    try {
      const remoteHtml = await fetchRemoteArticleHtml(url);
      const remoteStatus = validateFetchedHtml(remoteHtml);
      if (remoteStatus.status === 'Success') {
        return remoteHtml;
      }
      if (remoteStatus.notify) {
        await notifyArticleAccessTooFrequent({
          source: 'article-content',
          url,
          reason: remoteStatus.reason,
        });
      }
      if (!remoteStatus.retryable) {
        throw new NonRetryableArticleFetchError(remoteStatus.reason);
      }

      lastErrorMessage = remoteStatus.reason;
    } catch (error: any) {
      lastErrorMessage = error?.message || '获取文章内容失败，请重试';
      if (isNonRetryableArticleFetchError(error)) {
        throw error;
      }
      if (attempt === RETRY_POLICY.articleContent.retries) {
        break;
      }
    }
  }

  throw new Error(lastErrorMessage);
}

async function getRawArticleHtml(url: string): Promise<{ html: string; source: 'db' | 'remote' }> {
  const cachedHtml = await getCachedArticleHtml(url);
  if (cachedHtml) {
    const cachedStatus = validateFetchedHtml(cachedHtml);
    if (cachedStatus.status === 'Success') {
      return { html: cachedHtml, source: 'db' };
    }
    if (!cachedStatus.retryable) {
      if (cachedStatus.notify) {
        await notifyArticleAccessTooFrequent({
          source: 'article-content-cache',
          url,
          reason: cachedStatus.reason,
        });
      }
      throw new NonRetryableArticleFetchError(cachedStatus.reason);
    }
  }

  const remoteHtml = await fetchValidatedRemoteArticleHtml(url);
  return { html: remoteHtml, source: 'remote' };
}

async function parseArticleJson(rawHtml: string, source: 'db' | 'remote', url: string) {
  const cachedData = await parseCgiDataNew(rawHtml);
  if (cachedData || source === 'remote') {
    return cachedData;
  }

  const remoteHtml = await fetchValidatedRemoteArticleHtml(url);
  return await parseCgiDataNew(remoteHtml);
}

export async function resolveArticleContent(url: string, format: ArticleContentFormat): Promise<{
  content: string | Record<string, any> | null;
  contentType: string;
}> {
  if (shouldSkipMpArticleUrl(url)) {
    throw new NonRetryableArticleFetchError(UNSUPPORTED_MP_ARTICLE_URL_MESSAGE);
  }

  const { html, source } = await getRawArticleHtml(url);

  switch (format) {
    case 'html':
      return {
        content: normalizeHtml(html, 'html'),
        contentType: 'text/html; charset=UTF-8',
      };
    case 'text':
      return {
        content: normalizeHtml(html, 'text'),
        contentType: 'text/plain; charset=UTF-8',
      };
    case 'markdown':
      return {
        content: new TurndownService().turndown(normalizeHtml(html, 'html')),
        contentType: 'text/markdown; charset=UTF-8',
      };
    case 'json': {
      const data = await parseArticleJson(html, source, url);
      return {
        content: data,
        contentType: 'application/json; charset=UTF-8',
      };
    }
    default:
      throw new Error(`Unknown format ${format}`);
  }
}