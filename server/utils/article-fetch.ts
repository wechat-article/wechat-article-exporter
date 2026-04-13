import { isArticleAccessTooFrequentMessage } from '#shared/utils/html';
import { sendArticleAccessTooFrequentWarning } from '~/server/utils/email';

const DEFAULT_ARTICLE_FETCH_INTERVAL_MIN_MS = 500;
const DEFAULT_ARTICLE_FETCH_INTERVAL_MAX_MS = 2000;
const ARTICLE_ACCESS_TOO_FREQUENT_ALERT_COOLDOWN_MS = 30 * 60 * 1000;

let lastArticleAccessTooFrequentAlertAt = 0;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value || '', 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function getArticleFetchIntervalRange(): { minMs: number; maxMs: number } {
  const minMs = parseNonNegativeInteger(process.env.ARTICLE_FETCH_INTERVAL_MIN_MS, DEFAULT_ARTICLE_FETCH_INTERVAL_MIN_MS);
  const maxMs = parseNonNegativeInteger(process.env.ARTICLE_FETCH_INTERVAL_MAX_MS, DEFAULT_ARTICLE_FETCH_INTERVAL_MAX_MS);

  if (minMs <= maxMs) {
    return { minMs, maxMs };
  }

  return { minMs: maxMs, maxMs: minMs };
}

export function getRandomArticleFetchDelayMs(): number {
  const { minMs, maxMs } = getArticleFetchIntervalRange();
  if (minMs === maxMs) {
    return minMs;
  }

  return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

export async function waitRandomArticleFetchDelay(context: string): Promise<number> {
  const delayMs = getRandomArticleFetchDelayMs();
  console.log(`[article-fetch] ${context}，抓取等待 ${delayMs}ms`);
  if (delayMs > 0) {
    await delay(delayMs);
  }

  return delayMs;
}

export interface ArticleAccessTooFrequentNotice {
  source: string;
  url: string;
  title?: string;
  accountName?: string;
  reason?: string;
}

export class NonRetryableArticleFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NonRetryableArticleFetchError';
  }
}

export function isNonRetryableArticleFetchError(error: unknown): error is NonRetryableArticleFetchError {
  return error instanceof NonRetryableArticleFetchError;
}

export async function notifyArticleAccessTooFrequent(options: ArticleAccessTooFrequentNotice): Promise<boolean> {
  const reason = options.reason || '访问过于频繁，请用微信扫描二维码进行访问';
  if (!isArticleAccessTooFrequentMessage(reason)) {
    return false;
  }

  const now = Date.now();
  if (now - lastArticleAccessTooFrequentAlertAt < ARTICLE_ACCESS_TOO_FREQUENT_ALERT_COOLDOWN_MS) {
    console.warn(
      `[article-fetch] 命中过频访问限制，但仍在 ${Math.round(ARTICLE_ACCESS_TOO_FREQUENT_ALERT_COOLDOWN_MS / 60000)} 分钟冷却期内，跳过邮件发送 | ${options.url}`,
    );
    return false;
  }

  lastArticleAccessTooFrequentAlertAt = now;
  console.error(
    `[article-fetch] 命中过频访问限制，准备发送邮件告警 | source=${options.source} | account=${options.accountName || '-'} | title=${options.title || '-'} | url=${options.url}`,
  );

  return sendArticleAccessTooFrequentWarning({
    source: options.source,
    url: options.url,
    title: options.title,
    accountName: options.accountName,
    reason,
  });
}