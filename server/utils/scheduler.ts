import { getPool } from '~/server/db/postgres';
import { AccountCookie } from '~/server/utils/CookieStore';
import { sendCookieExpiryWarning, sendSyncReport } from '~/server/utils/email';
import { getActiveSession, syncAccountByRange, type SyncAccountResult } from '~/server/utils/sync-engine';

const SECONDS_PER_DAY = 24 * 60 * 60;
const COOKIE_WARNING_WINDOW_SEC = SECONDS_PER_DAY;
const DEFAULT_SCHEDULER_SYNC_DAYS = 3;

export function getSchedulerSyncDays(): number {
  const rawValue = Number(process.env.SCHEDULER_SYNC_DAYS || DEFAULT_SCHEDULER_SYNC_DAYS);
  if (!Number.isFinite(rawValue) || rawValue <= 0) {
    return DEFAULT_SCHEDULER_SYNC_DAYS;
  }

  return Math.max(1, Math.floor(rawValue));
}

/**
 * 检查所有 session 的 cookie 过期时间，如果任意 session 剩余不足 24 小时则发邮件提醒
 */
export async function checkCookieExpiry(): Promise<void> {
  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  const res = await pool.query(
    `SELECT auth_key, token, cookies, expires_at FROM session WHERE expires_at > $1`,
    [now],
  );

  if (res.rows.length === 0) {
    console.warn('[schedule] 没有有效的 session，无法同步。请先登录微信公众号平台。');
    await sendCookieExpiryWarning('当前没有任何有效的登录会话，请立即重新扫码登录。');
    return;
  }

  const expiryWarnings: string[] = [];
  for (const row of res.rows) {
    const accountCookie = AccountCookie.create(row.token, row.cookies);
    const cookies = row.cookies as Array<Record<string, any>>;

    const sessionRemainSec = row.expires_at - now;
    if (sessionRemainSec < COOKIE_WARNING_WINDOW_SEC) {
      const hours = Math.round(sessionRemainSec / 3600 * 10) / 10;
      expiryWarnings.push(`Session(${row.auth_key.substring(0, 8)}...): 剩余 ${hours} 小时`);
    }

    for (const cookie of cookies) {
      if (typeof cookie.expires_timestamp === 'number') {
        const remainMs = cookie.expires_timestamp - Date.now();
        const remainSec = remainMs / 1000;
        if (remainSec > 0 && remainSec < COOKIE_WARNING_WINDOW_SEC) {
          const hours = Math.round(remainSec / 3600 * 10) / 10;
          expiryWarnings.push(`Cookie "${cookie.name}": 剩余 ${hours} 小时 (${new Date(cookie.expires_timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
        }
      }
    }

    if (accountCookie.isExpired) {
      expiryWarnings.push(`Session(${row.auth_key.substring(0, 8)}...): Cookie 已过期`);
    }
  }

  if (expiryWarnings.length > 0) {
    console.warn('[schedule] Cookie 即将过期:\n' + expiryWarnings.join('\n'));
    await sendCookieExpiryWarning(expiryWarnings.join('\n'));
  } else {
    console.log('[schedule] Cookie 有效期正常');
  }
}

/**
 * 执行定时自动同步：同步所有公众号最近 N 天的文章，逻辑与手动同步一致，仅时间范围不同
 */
export async function runAutoSync(): Promise<void> {
  const startTime = Date.now();
  const syncDays = getSchedulerSyncDays();
  console.log('[schedule] ========== 定时同步任务开始 ==========');
  console.log(`[schedule] 本次定时同步范围: 最近 ${syncDays} 天文章，并为该范围生成文档`);

  await checkCookieExpiry();

  const session = await getActiveSession();
  if (!session) {
    console.error('[schedule] 没有有效的 session，跳过同步');
    return;
  }
  console.log(`[schedule] 使用 session: ${session.authKey.substring(0, 8)}...`);

  const pool = getPool();
  const accountsRes = await pool.query(`SELECT fakeid, nickname, round_head_img FROM info`);
  const accounts = accountsRes.rows;

  if (accounts.length === 0) {
    console.log('[schedule] 没有需要同步的公众号');
    return;
  }
  console.log(`[schedule] 共 ${accounts.length} 个公众号待同步`);

  const syncToTimestamp = Math.round(Date.now() / 1000) - syncDays * SECONDS_PER_DAY;
  const results: SyncAccountResult[] = [];

  for (const [index, account] of accounts.entries()) {
    const result = await syncAccountByRange({
      token: session.token,
      cookie: session.cookie,
      fakeid: account.fakeid,
      nickname: account.nickname || account.fakeid,
      roundHeadImg: account.round_head_img,
      syncToTimestamp,
      source: 'schedule',
      exportDocs: true,
    });
    results.push(result);

    if (result.error === 'session expired') {
      console.error('[schedule] Session 已过期，中止同步');
      await sendCookieExpiryWarning('定时同步过程中 Session 已过期，请立即重新扫码登录。');
      break;
    }

    if (index < accounts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  for (const result of results) {
    if (result.failedUrls.length > 0) {
      console.error(`[schedule] 【${result.nickname}】失败列表汇总 (${result.failedUrls.length} 条):`);
      result.failedUrls.forEach((item, i) => console.error(`  ${i + 1}. ${item}`));
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  const details = results
    .map((result) => {
      const status = result.success ? '[OK]' : '[FAIL]';
      const summary = result.success
        ? `${result.articleCount} 篇，同步导出: 生成 ${result.generated}，跳过 ${result.skipped}，失败 ${result.failed}`
        : result.error || '未知错误';
      return `${status} ${result.nickname}: ${summary}`;
    })
    .join('\n');

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[schedule] ========== 定时同步任务完成 (${elapsed}s) ==========\n${details}`);

  if (failedCount > 0) {
    await sendSyncReport({
      total: results.length,
      success: successCount,
      failed: failedCount,
      details,
    });
  }
}