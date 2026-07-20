import * as cheerio from 'cheerio';
import { USER_AGENT } from '~/config';

interface AccountNameQuery {
  url: string;
}

// 允许服务端请求的微信域名白名单
const ALLOWED_HOSTS = new Set(['mp.weixin.qq.com', 'weixin.qq.com']);

/**
 * 验证 URL 是否为允许的微信域名
 */
function isAllowedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    // 只允许 https 协议
    if (parsed.protocol !== 'https:') {
      return false;
    }
    return ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * 根据文章 url 获取公众号名称
 */
export default defineEventHandler(async event => {
  let { url } = getQuery<AccountNameQuery>(event);
  url = decodeURIComponent(url);

  if (!isAllowedUrl(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: '不允许的 URL：仅支持微信公众平台域名',
    });
  }

  // Cloudflare Workers fetch 不支持 redirect: 'error'，使用 'manual' 后手动判断状态码以达到反 SSRF 效果
  const res = await fetch(url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
    redirect: 'manual',
  });
  if (res.status >= 300 && res.status < 400) {
    throw createError({
      statusCode: 502,
      statusMessage: `目标 URL 发生重定向 (status=${res.status})，已拒绝以防止 SSRF`,
    });
  }
  const rawHtml = await res.text();

  // 微信改版后文章页移除了 .wx_follow_nickname 这个 class，公众号名称改为承载在内联 JS 变量里。
  // 优先从 `var nickname = htmlDecode("…")` / `var nickname = "…"` 提取，兼容新旧两种写法。
  const match = rawHtml.match(/var\s+nickname\s*=\s*(?:htmlDecode\()?\s*["']([^"']+)["']/);
  if (match) {
    // 借助 cheerio 顺带解码 HTML 实体（如 &amp; -> &）；公众号昵称不含尖括号，拼接安全
    return cheerio.load(`<div>${match[1]}</div>`).text().trim();
  }

  // 兜底：旧结构的 .wx_follow_nickname，或新结构中已渲染的 .account_nickname_inner
  const $ = cheerio.load(rawHtml);
  return $('.wx_follow_nickname, .account_nickname_inner').first().text().trim();
});
