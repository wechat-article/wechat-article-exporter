import { ARTICLE_LIST_PAGE_SIZE, USER_AGENT } from '~/config';
import type { AppMsgEx, PublishInfo, PublishListItem } from '~/types/types';
import { getPool } from '~/server/db/postgres';
import { AccountCookie, cookieStore } from '~/server/utils/CookieStore';
import { resolveArticleCover, resolveArticleDeleted, resolveArticleDigest } from '~/server/utils/article-record';
import { compactEscapedJson } from '~/server/utils/async-log';
import {
  generateAggregateExportsForAccount,
  generateDocxForArticleUrls,
  type ArticleExportProgress,
  type ArticleExportRetryProgress,
  type AutoExportResult,
  type ExportSource,
} from '~/server/utils/docx-generator';
import { getPreferencesFromDB } from '~/server/utils/preferences';

const DEFAULT_SYNC_INTERVAL_MS = 5000;
const MAX_PAGE_RETRIES = 3;
const MAX_EMPTY_PAGE_RETRIES = 2;

export interface ActiveSession {
  authKey: string;
  token: string;
  cookie: string;
}

export interface SyncPageProgress {
  begin: number;
  pageNumber: number;
  rawCount: number;
  articleCount: number;
  filteredCount: number;
  totalCount: number;
  completed: boolean;
}

export interface SyncRetryProgress {
  stage: 'syncing';
  scope: 'page-fetch' | 'empty-page';
  pageNumber: number;
  begin: number;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  message: string;
}

export interface SyncAccountResult {
  fakeid: string;
  nickname: string;
  success: boolean;
  articleCount: number;
  failedUrls: string[];
  generated: number;
  skipped: number;
  failed: number;
  error?: string;
}

export interface SyncAccountOptions {
  authKey?: string;
  token: string;
  cookie: string;
  fakeid: string;
  nickname: string;
  roundHeadImg?: string | null;
  syncToTimestamp: number;
  source: ExportSource;
  delayMs?: number;
  exportDocs?: boolean;
  isCancelled?: () => boolean;
  onPageFetched?: (progress: SyncPageProgress) => void | Promise<void>;
  onExportArticleStart?: (progress: ArticleExportProgress) => void | Promise<void>;
  onRetry?: (progress: SyncRetryProgress | ArticleExportRetryProgress) => void | Promise<void>;
  onStageChange?: (stage: 'syncing' | 'exporting' | 'finalizing') => void | Promise<void>;
}

interface FetchPageResult {
  publishList: PublishListItem[];
  articles: AppMsgEx[];
  completed: boolean;
  totalCount: number;
  rawCount: number;
}

interface FilteredPageResult {
  publishList: PublishListItem[];
  articles: AppMsgEx[];
  urls: string[];
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureNotCancelled(isCancelled?: () => boolean) {
  if (isCancelled?.()) {
    throw new Error('cancelled');
  }
}

function createEmptyExportTotals(): AutoExportResult {
  return {
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    formats: [],
    errors: [],
  };
}

function mergeExportTotals(target: AutoExportResult, next: AutoExportResult) {
  target.total += next.total;
  target.generated += next.generated;
  target.skipped += next.skipped;
  target.failed += next.failed;
  target.formats = next.formats.length > 0 ? next.formats : target.formats;
  target.errors.push(...next.errors);
}

function parsePublishInfo(item: PublishListItem): PublishInfo {
  return JSON.parse(item.publish_info) as PublishInfo;
}

async function upsertInfoRow(client: any, input: {
  fakeid: string;
  nickname?: string | null;
  roundHeadImg?: string | null;
  totalCount: number;
  msgCount: number;
  articleCount: number;
  completed: boolean;
}) {
  const existing = await client.query(`SELECT * FROM info WHERE fakeid = $1`, [input.fakeid]);
  const now = Math.round(Date.now() / 1000);

  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const newCompleted = input.completed ? true : row.completed;
    await client.query(
      `UPDATE info SET
         completed = $2,
         count = count + $3,
         articles = articles + $4,
         nickname = COALESCE($5, nickname),
         round_head_img = COALESCE($6, round_head_img),
         total_count = $7,
         update_time = $8
       WHERE fakeid = $1`,
      [
        input.fakeid,
        newCompleted,
        input.msgCount,
        input.articleCount,
        input.nickname,
        input.roundHeadImg,
        input.totalCount,
        now,
      ]
    );
    return;
  }

  await client.query(
    `INSERT INTO info (fakeid, completed, count, articles, nickname, round_head_img, total_count, create_time, update_time)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      input.fakeid,
      input.completed,
      input.msgCount,
      input.articleCount,
      input.nickname || input.fakeid,
      input.roundHeadImg || '',
      input.totalCount,
      now,
      now,
    ]
  );
}

async function savePublishPageToDB(input: {
  fakeid: string;
  nickname: string;
  roundHeadImg?: string | null;
  publishList: PublishListItem[];
  totalCount: number;
  completed: boolean;
}) {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let msgCount = 0;
    let articleCount = 0;

    for (const item of input.publishList) {
      const publishInfo = parsePublishInfo(item);
      let newEntryCount = 0;

      for (const article of publishInfo.appmsgex || []) {
        const key = `${input.fakeid}:${article.aid}`;
        const data = { ...article, fakeid: input.fakeid, _status: '' };
        const cover = resolveArticleCover(article);
        const digest = resolveArticleDigest(article);
        const isDeleted = resolveArticleDeleted(article);
        const res = await client.query(
          `INSERT INTO article (id, fakeid, link, create_time, update_time, article_title, article_status, cover, digest, is_deleted, data)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
           ON CONFLICT (id) DO UPDATE SET
             fakeid = EXCLUDED.fakeid,
             link = EXCLUDED.link,
             create_time = EXCLUDED.create_time,
             update_time = EXCLUDED.update_time,
             article_title = EXCLUDED.article_title,
             article_status = EXCLUDED.article_status,
             cover = EXCLUDED.cover,
             digest = EXCLUDED.digest,
             is_deleted = EXCLUDED.is_deleted,
             data = EXCLUDED.data
           RETURNING (xmax = 0) AS is_new`,
          [
            key,
            input.fakeid,
            article.link,
            article.create_time,
            article.update_time,
            article.title || null,
            Number.isFinite(article.mediaapi_publish_status) ? article.mediaapi_publish_status : null,
            cover,
            digest,
            isDeleted,
            data,
          ]
        );

        if (res.rows[0].is_new) {
          newEntryCount++;
          articleCount++;
        }
      }

      if (newEntryCount > 0) {
        msgCount++;
      }
    }

    await upsertInfoRow(client, {
      fakeid: input.fakeid,
      nickname: input.nickname,
      roundHeadImg: input.roundHeadImg,
      totalCount: input.totalCount,
      msgCount,
      articleCount,
      completed: input.completed,
    });

    await client.query('COMMIT');
    return { msgCount, articleCount };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function touchLastUpdateTime(fakeid: string) {
  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  await pool.query(`UPDATE info SET last_update_time = $2 WHERE fakeid = $1`, [fakeid, now]);
}

async function fetchArticlesPageOnce(
  authKey: string | undefined,
  token: string,
  cookie: string,
  fakeid: string,
  begin: number,
  source: ExportSource,
): Promise<FetchPageResult> {
  const params = new URLSearchParams({
    sub: 'list',
    search_field: 'null',
    begin: String(begin),
    count: String(ARTICLE_LIST_PAGE_SIZE),
    query: '',
    fakeid,
    type: '101_1',
    free_publish_type: '1',
    sub_action: 'list_ex',
    token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  });

  const url = `https://mp.weixin.qq.com/cgi-bin/appmsgpublish?${params.toString()}`;
  const latestCookie = authKey ? await cookieStore.getCookie(authKey) : null;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Cookie: latestCookie || cookie,
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
      'Accept-Encoding': 'identity',
    },
  });

  if (authKey) {
    const setCookies = response.headers.getSetCookie();
    if (setCookies.length > 0) {
      await cookieStore.updateCookie(authKey, setCookies);
    }
  }

  const data = await response.json();
  const tag = `[${source}]`;
  console.log(`${tag} 微信API原始响应 (fakeid=${fakeid}, begin=${begin}):\n${compactEscapedJson(data)}`);

  if (data.base_resp?.ret === 200003) {
    throw new Error('session expired');
  }
  if (data.base_resp?.ret !== 0) {
    throw new Error(`WeChat API error: ${data.base_resp?.ret} - ${data.base_resp?.err_msg || 'unknown'}`);
  }

  const publishPage = JSON.parse(data.publish_page);
  const rawPublishList = publishPage.publish_list ?? [];
  const publishList = rawPublishList.filter((item: PublishListItem) => !!item.publish_info);
  const completed = rawPublishList.length === 0;

  const articles = publishList.flatMap((item: PublishListItem) => parsePublishInfo(item).appmsgex || []);
  const rawCount = rawPublishList.length;
  const msgCount = articles.filter(article => article.itemidx === 1).length;

  console.log(
    `${tag} 本页解析: fakeid=${fakeid}, begin=${begin}, 文章数=${articles.length}, 消息数=${msgCount}, 原始条目数=${rawCount}, completed=${completed}, totalCount=${publishPage.total_count}`,
  );

  return {
    publishList,
    articles,
    completed,
    totalCount: publishPage.total_count,
    rawCount,
  };
}

async function fetchArticlesPageWithRetry(
  authKey: string | undefined,
  token: string,
  cookie: string,
  fakeid: string,
  begin: number,
  source: ExportSource,
  pageNumber: number,
  nickname: string,
  onRetry?: (progress: SyncRetryProgress) => void | Promise<void>,
): Promise<FetchPageResult> {
  let page: FetchPageResult | null = null;

  for (let attempt = 0; attempt < MAX_PAGE_RETRIES; attempt++) {
    try {
      page = await fetchArticlesPageOnce(authKey, token, cookie, fakeid, begin, source);
      break;
    } catch (error: any) {
      console.error(`[${source}] ${fakeid} 第 ${pageNumber} 页请求失败 (${attempt + 1}/${MAX_PAGE_RETRIES}):`, error);
      if (error?.message === 'session expired' || attempt === MAX_PAGE_RETRIES - 1) {
        throw error;
      }
      const retryAttempt = attempt + 1;
      const retryTotal = Math.max(1, MAX_PAGE_RETRIES - 1);
      const delayMs = Math.pow(2, attempt + 1) * 1000;
      const retryMessage = `正在重试同步列表第 ${pageNumber} 页，第 ${retryAttempt}/${retryTotal} 次`;
      console.warn(
        `[${source}] 【${nickname}】${retryMessage}，${delayMs / 1000} 秒后继续 (begin=${begin})，原因: ${error?.message || error}`,
      );
      await onRetry?.({
        stage: 'syncing',
        scope: 'page-fetch',
        pageNumber,
        begin,
        attempt: retryAttempt,
        maxAttempts: retryTotal,
        delayMs,
        message: retryMessage,
      });
      await delay(delayMs);
    }
  }

  if (!page) {
    throw new Error('unreachable');
  }

  if (page.completed && begin < page.totalCount) {
    for (let retry = 1; retry <= MAX_EMPTY_PAGE_RETRIES; retry++) {
      const retryMessage = `同步列表第 ${pageNumber} 页返回空数据，正在第 ${retry}/${MAX_EMPTY_PAGE_RETRIES} 次重试`;
      console.warn(
        `[${source}] 【${nickname}】${retryMessage}，${DEFAULT_SYNC_INTERVAL_MS / 1000}s 后继续 (begin=${begin}, total_count=${page.totalCount})`,
      );
      await onRetry?.({
        stage: 'syncing',
        scope: 'empty-page',
        pageNumber,
        begin,
        attempt: retry,
        maxAttempts: MAX_EMPTY_PAGE_RETRIES,
        delayMs: DEFAULT_SYNC_INTERVAL_MS,
        message: retryMessage,
      });
      await delay(DEFAULT_SYNC_INTERVAL_MS);
      const retryPage = await fetchArticlesPageOnce(authKey, token, cookie, fakeid, begin, source);
      if (!retryPage.completed) {
        return retryPage;
      }
      page = retryPage;
    }
  }

  return page;
}

function filterPublishListForSync(
  fakeid: string,
  publishList: PublishListItem[],
  syncToTimestamp: number,
  seenArticleKeys: Set<string>,
): FilteredPageResult {
  const nextPublishList: PublishListItem[] = [];
  const nextArticles: AppMsgEx[] = [];
  const urls: string[] = [];

  for (const item of publishList) {
    const publishInfo = parsePublishInfo(item);
    const filteredArticles = (publishInfo.appmsgex || []).filter((article) => {
      if (article.update_time < syncToTimestamp) {
        return false;
      }

      const articleKey = `${fakeid}:${article.aid || article.link}`;
      if (seenArticleKeys.has(articleKey)) {
        return false;
      }

      seenArticleKeys.add(articleKey);
      return true;
    });

    if (filteredArticles.length === 0) {
      continue;
    }

    nextArticles.push(...filteredArticles);
    urls.push(...filteredArticles.map(article => article.link).filter(Boolean));
    nextPublishList.push({
      ...item,
      publish_info: JSON.stringify({ ...publishInfo, appmsgex: filteredArticles }),
    });
  }

  return {
    publishList: nextPublishList,
    articles: nextArticles,
    urls,
  };
}

export async function getActiveSession(): Promise<ActiveSession | null> {
  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  const res = await pool.query(
    `SELECT auth_key, token, cookies FROM session WHERE expires_at > $1 ORDER BY created_at DESC LIMIT 1`,
    [now],
  );
  if (res.rows.length === 0) {
    return null;
  }

  const row = res.rows[0];
  const accountCookie = AccountCookie.create(row.token, row.cookies);
  return {
    authKey: row.auth_key,
    token: row.token,
    cookie: accountCookie.toString(),
  };
}

export async function getSyncIntervalMs(): Promise<number> {
  const preferences = await getPreferencesFromDB();
  const seconds = preferences?.accountSyncSeconds ?? DEFAULT_SYNC_INTERVAL_MS / 1000;
  return Math.max(1, seconds) * 1000;
}

export async function syncAccountByRange(options: SyncAccountOptions): Promise<SyncAccountResult> {
  const intervalMs = options.delayMs ?? await getSyncIntervalMs();
  const exportTotals = createEmptyExportTotals();
  const failedUrls: string[] = [];
  const seenArticleKeys = new Set<string>();

  let begin = 0;
  let pageNumber = 0;
  let syncedArticles = 0;

  console.log(
    `[${options.source}] 开始同步【${options.nickname}】(${options.fakeid})，截止时间: ${new Date(options.syncToTimestamp * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
  );

  try {
    while (true) {
      ensureNotCancelled(options.isCancelled);

      pageNumber += 1;
      await options.onStageChange?.('syncing');
      const page = await fetchArticlesPageWithRetry(
        options.authKey,
        options.token,
        options.cookie,
        options.fakeid,
        begin,
        options.source,
        pageNumber,
        options.nickname,
        options.onRetry,
      );
      const filtered = filterPublishListForSync(options.fakeid, page.publishList, options.syncToTimestamp, seenArticleKeys);

      await options.onPageFetched?.({
        begin,
        pageNumber,
        rawCount: page.rawCount,
        articleCount: page.articles.length,
        filteredCount: filtered.articles.length,
        totalCount: page.totalCount,
        completed: page.completed,
      });

      if (page.completed) {
        await savePublishPageToDB({
          fakeid: options.fakeid,
          nickname: options.nickname,
          roundHeadImg: options.roundHeadImg,
          publishList: [],
          totalCount: page.totalCount,
          completed: true,
        });
        break;
      }

      if (filtered.publishList.length > 0) {
        const saveResult = await savePublishPageToDB({
          fakeid: options.fakeid,
          nickname: options.nickname,
          roundHeadImg: options.roundHeadImg,
          publishList: filtered.publishList,
          totalCount: page.totalCount,
          completed: false,
        });
        syncedArticles += saveResult.articleCount;

        if (options.exportDocs !== false && filtered.urls.length > 0) {
          await options.onStageChange?.('exporting');
          const exportResult = await generateDocxForArticleUrls(
            options.fakeid,
            filtered.urls,
            options.source,
            options.onExportArticleStart,
            options.isCancelled,
            options.onRetry,
          );
          mergeExportTotals(exportTotals, exportResult);
          failedUrls.push(...exportResult.errors);
        }
      }

      const oldest = page.articles.at(-1);
      begin += page.rawCount;

      if (oldest && oldest.update_time < options.syncToTimestamp) {
        break;
      }

      if (page.rawCount === 0) {
        break;
      }

      await delay(intervalMs);
    }

    await touchLastUpdateTime(options.fakeid);

    if (options.exportDocs !== false) {
      await options.onStageChange?.('finalizing');
      const aggregateResult = await generateAggregateExportsForAccount(
        options.fakeid,
        options.syncToTimestamp,
        options.source,
        options.isCancelled,
      );
      mergeExportTotals(exportTotals, aggregateResult);
      failedUrls.push(...aggregateResult.errors);
    }

    return {
      fakeid: options.fakeid,
      nickname: options.nickname,
      success: true,
      articleCount: syncedArticles,
      failedUrls,
      generated: exportTotals.generated,
      skipped: exportTotals.skipped,
      failed: exportTotals.failed,
    };
  } catch (error: any) {
    console.error(`[${options.source}] 【${options.nickname}】同步失败:`, error);
    return {
      fakeid: options.fakeid,
      nickname: options.nickname,
      success: false,
      articleCount: syncedArticles,
      failedUrls,
      generated: exportTotals.generated,
      skipped: exportTotals.skipped,
      failed: exportTotals.failed,
      error: error?.message || 'unknown error',
    };
  }
}