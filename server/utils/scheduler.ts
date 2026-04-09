import { ARTICLE_LIST_PAGE_SIZE, USER_AGENT } from '~/config';
import { getPool } from '~/server/db/postgres';
import { AccountCookie } from '~/server/utils/CookieStore';
import { sendCookieExpiryWarning, sendSyncReport } from '~/server/utils/email';
import { generateDocxForAccount } from '~/server/utils/docx-generator';

const SYNC_INTERVAL_MS = 5000; // 每页间隔 5 秒，避免请求过快
const TWENTY_FOUR_HOURS_SEC = 24 * 60 * 60;

interface SyncResult {
  fakeid: string;
  nickname: string;
  success: boolean;
  articleCount: number;
  failedUrls: string[];
  error?: string;
}

/**
 * 从数据库获取第一个有效的 session（auth_key + token + cookies）
 */
async function getActiveSession(): Promise<{ authKey: string; token: string; cookie: string } | null> {
  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  const res = await pool.query(
    `SELECT auth_key, token, cookies FROM session WHERE expires_at > $1 ORDER BY created_at DESC LIMIT 1`,
    [now]
  );
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const accountCookie = AccountCookie.create(row.token, row.cookies);
  return {
    authKey: row.auth_key,
    token: row.token,
    cookie: accountCookie.toString(),
  };
}

/**
 * 检查所有 session 的 cookie 过期时间，如果任意 session 剩余不足 24 小时则发邮件提醒
 */
export async function checkCookieExpiry(): Promise<void> {
  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  const res = await pool.query(
    `SELECT auth_key, token, cookies, expires_at FROM session WHERE expires_at > $1`,
    [now]
  );

  if (res.rows.length === 0) {
    console.warn('[scheduler] 没有有效的 session，无法同步。请先登录微信公众号平台。');
    await sendCookieExpiryWarning('当前没有任何有效的登录会话，请立即重新扫码登录。');
    return;
  }

  const expiryWarnings: string[] = [];
  for (const row of res.rows) {
    const accountCookie = AccountCookie.create(row.token, row.cookies);
    const cookies = row.cookies as Array<Record<string, any>>;

    // 检查 session 表的 expires_at
    const sessionRemainSec = row.expires_at - now;
    if (sessionRemainSec < TWENTY_FOUR_HOURS_SEC) {
      const hours = Math.round(sessionRemainSec / 3600 * 10) / 10;
      expiryWarnings.push(`Session(${row.auth_key.substring(0, 8)}...): 剩余 ${hours} 小时`);
    }

    // 检查每个 cookie 的 expires_timestamp
    for (const cookie of cookies) {
      if (typeof cookie.expires_timestamp === 'number') {
        const remainMs = cookie.expires_timestamp - Date.now();
        const remainSec = remainMs / 1000;
        if (remainSec > 0 && remainSec < TWENTY_FOUR_HOURS_SEC) {
          const hours = Math.round(remainSec / 3600 * 10) / 10;
          expiryWarnings.push(`Cookie "${cookie.name}": 剩余 ${hours} 小时 (${new Date(cookie.expires_timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })})`);
        }
      }
    }
  }

  if (expiryWarnings.length > 0) {
    console.warn('[scheduler] Cookie 即将过期:\n' + expiryWarnings.join('\n'));
    await sendCookieExpiryWarning(expiryWarnings.join('\n'));
  } else {
    console.log('[scheduler] Cookie 有效期正常');
  }
}

/**
 * 从微信 API 获取文章列表（服务端直接调用）
 */
async function fetchArticlesFromWeChat(
  token: string,
  cookie: string,
  fakeid: string,
  begin: number
): Promise<{ articles: any[]; completed: boolean; totalCount: number }> {
  const params = new URLSearchParams({
    sub: 'list',
    search_field: 'null',
    begin: String(begin),
    count: String(ARTICLE_LIST_PAGE_SIZE),
    query: '',
    fakeid: fakeid,
    type: '101_1',
    free_publish_type: '1',
    sub_action: 'list_ex',
    token: token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  });

  const url = `https://mp.weixin.qq.com/cgi-bin/appmsgpublish?${params.toString()}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Cookie: cookie,
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
      'Accept-Encoding': 'identity',
    },
  });

  const data = await response.json();

  if (data.base_resp?.ret === 200003) {
    throw new Error('session expired');
  }
  if (data.base_resp?.ret !== 0) {
    throw new Error(`WeChat API error: ${data.base_resp?.ret} - ${data.base_resp?.err_msg || 'unknown'}`);
  }

  const publishPage = JSON.parse(data.publish_page);
  console.log(`[scheduler] 微信API返回 publish_page 字段: total_count=${publishPage.total_count}, publish_list.length=${publishPage.publish_list?.length ?? 0}`);

  const publishList = publishPage.publish_list.filter((item: any) => !!item.publish_info);
  const completed = publishList.length === 0;

  const articles = publishList.flatMap((item: any) => {
    const publishInfo = JSON.parse(item.publish_info);
    return publishInfo.appmsgex;
  });

  console.log(`[scheduler] 本页解析文章数: ${articles.length}，completed=${completed}，totalCount=${publishPage.total_count}`);
  return { articles, completed, totalCount: publishPage.total_count };
}

/**
 * 将文章保存到数据库
 */
async function saveArticlesToDB(fakeid: string, articles: any[], nickname: string, totalCount: number): Promise<{ msgCount: number; articleCount: number }> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let msgCount = 0;
    let articleCount = 0;

    // 按 publish item 分组（模拟 publishList 的结构）
    for (const article of articles) {
      const key = `${fakeid}:${article.aid}`;
      const data = { ...article, fakeid, _status: '' };

      const res = await client.query(
        `INSERT INTO article (id, fakeid, link, create_time, update_time, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           link = EXCLUDED.link,
           create_time = EXCLUDED.create_time,
           update_time = EXCLUDED.update_time,
           data = EXCLUDED.data
         RETURNING (xmax = 0) AS is_new`,
        [key, fakeid, article.link, article.create_time, article.update_time, data]
      );

      if (res.rows[0].is_new) {
        articleCount++;
        if (article.itemidx === 1) {
          msgCount++;
        }
        console.log(`[scheduler] 新文章入库: [${article.aid}] ${article.title || '(无标题)'} itemidx=${article.itemidx}`);
      }
    }

    // 更新 info 表
    const infoRes = await client.query(`SELECT count, articles, total_count FROM info WHERE fakeid = $1`, [fakeid]);
    if (infoRes.rows.length > 0) {
      const before = infoRes.rows[0];
      await client.query(
        `UPDATE info SET
           count = count + $2,
           articles = articles + $3,
           total_count = $4,
           update_time = $5
         WHERE fakeid = $1`,
        [fakeid, msgCount, articleCount, totalCount, Math.round(Date.now() / 1000)]
      );
      console.log(`[scheduler] info表更新: count ${before.count} -> ${before.count + msgCount}，articles ${before.articles} -> ${before.articles + articleCount}，total_count ${before.total_count} -> ${totalCount}（微信API值）`);
    }

    // 更新 last_update_time
    await client.query(
      `UPDATE info SET last_update_time = $2 WHERE fakeid = $1`,
      [fakeid, Math.round(Date.now() / 1000)]
    );

    await client.query('COMMIT');
    return { msgCount, articleCount };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 同步单个公众号最近 24 小时的文章
 */
async function syncAccount(
  token: string,
  cookie: string,
  fakeid: string,
  nickname: string
): Promise<SyncResult> {
  const syncToTimestamp = Math.round(Date.now() / 1000) - TWENTY_FOUR_HOURS_SEC;
  let begin = 0;
  let totalArticles: any[] = [];
  let totalCount = 0;

  console.log(`[scheduler] 开始同步【${nickname}】(${fakeid})，截止时间: ${new Date(syncToTimestamp * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`);

  try {
    while (true) {
      const { articles, completed, totalCount: tc } = await fetchArticlesFromWeChat(token, cookie, fakeid, begin);
      totalCount = tc;

      if (completed || articles.length === 0) {
        break;
      }

      // 过滤最近 24 小时的文章
      const filtered = articles.filter((a: any) => a.update_time >= syncToTimestamp);
      totalArticles.push(...filtered);

      // 如果最旧的文章已经超过截止时间，停止翻页
      const oldest = articles[articles.length - 1];
      if (oldest.update_time < syncToTimestamp) {
        break;
      }

      // 计算下一页
      const msgCountThisPage = articles.filter((a: any) => a.itemidx === 1).length;
      begin += msgCountThisPage;

      // 分页间隔
      await new Promise(resolve => setTimeout(resolve, SYNC_INTERVAL_MS));
    }

    // 保存到数据库
    if (totalArticles.length > 0) {
      const { msgCount, articleCount } = await saveArticlesToDB(fakeid, totalArticles, nickname, totalCount);
      console.log(`[scheduler] 【${nickname}】同步完成: 新增 ${articleCount} 篇文章，${msgCount} 条消息`);
    } else {
      console.log(`[scheduler] 【${nickname}】无新文章`);
    }

    return { fakeid, nickname, success: true, articleCount: totalArticles.length, failedUrls: [] };
  } catch (e: any) {
    console.error(`[scheduler] 【${nickname}】同步失败:`, e);
    return { fakeid, nickname, success: false, articleCount: 0, failedUrls: [], error: e.message };
  }
}

/**
 * 执行定时自动同步：同步所有公众号最近 24 小时的文章
 */
export async function runAutoSync(): Promise<void> {
  const startTime = Date.now();
  console.log('[scheduler] ========== 定时同步任务开始 ==========');

  // 1. 检查 Cookie 有效期
  await checkCookieExpiry();

  // 2. 获取有效 session
  const session = await getActiveSession();
  if (!session) {
    console.error('[scheduler] 没有有效的 session，跳过同步');
    return;
  }
  console.log(`[scheduler] 使用 session: ${session.authKey.substring(0, 8)}...`);

  // 3. 获取所有公众号
  const pool = getPool();
  const accountsRes = await pool.query(`SELECT fakeid, nickname FROM info`);
  const accounts = accountsRes.rows;

  if (accounts.length === 0) {
    console.log('[scheduler] 没有需要同步的公众号');
    return;
  }
  console.log(`[scheduler] 共 ${accounts.length} 个公众号待同步`);

  // 4. 逐个同步
  const results: SyncResult[] = [];
  for (const account of accounts) {
    const result = await syncAccount(session.token, session.cookie, account.fakeid, account.nickname || account.fakeid);
    results.push(result);

    // 如果 session 过期则中止
    if (result.error === 'session expired') {
      console.error('[scheduler] Session 已过期，中止同步');
      await sendCookieExpiryWarning('定时同步过程中 Session 已过期，请立即重新扫码登录。');
      break;
    }

    // 账号间间隔
    if (accounts.indexOf(account) < accounts.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  // 5. 自动导出
  for (const result of results) {
    if (result.success && result.articleCount > 0) {
      try {
        const exportResult = await generateDocxForAccount(result.fakeid);
        console.log(`[scheduler] 【${result.nickname}】自动导出: 生成=${exportResult.generated} 跳过=${exportResult.skipped} 失败=${exportResult.failed}`);
        if (exportResult.errors.length > 0) {
          result.failedUrls.push(...exportResult.errors);
          console.error(`[scheduler] 【${result.nickname}】导出失败列表:`);
          exportResult.errors.forEach((err, i) => console.error(`  ${i + 1}. ${err}`));
        }
      } catch (e) {
        // AUTO_EXPORT_DIR 未配置时静默跳过
        if (!(e instanceof Error && e.message?.includes('AUTO_EXPORT_DIR'))) {
          console.error(`[scheduler] 【${result.nickname}】自动导出失败:`, e);
        }
      }
    }
  }

  // 6. 打印每个公众号的失败 URL 汇总
  for (const result of results) {
    if (result.failedUrls.length > 0) {
      console.error(`[scheduler] 【${result.nickname}】失败列表汇总 (${result.failedUrls.length} 条):`);
      result.failedUrls.forEach((url, i) => console.error(`  ${i + 1}. ${url}`));
    }
  }

  // 7. 发送同步报告
  const successCount = results.filter(r => r.success).length;
  const failedCount = results.filter(r => !r.success).length;
  const details = results
    .map(r => {
      const status = r.success ? '✅' : '❌';
      const info = r.success ? `${r.articleCount} 篇` : r.error || '未知错误';
      return `${status} ${r.nickname}: ${info}`;
    })
    .join('\n');

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`[scheduler] ========== 定时同步任务完成 (${elapsed}s) ==========\n${details}`);

  // 有失败时发送邮件通知
  if (failedCount > 0) {
    await sendSyncReport({
      total: results.length,
      success: successCount,
      failed: failedCount,
      details,
    });
  }
}
