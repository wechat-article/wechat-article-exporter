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

  const $ = cheerio.load(rawHtml);
  return $('.wx_follow_nickname:first').text().trim();
});
