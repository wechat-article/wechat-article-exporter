import * as cheerio from 'cheerio';
import { USER_AGENT } from '~/config';
import {
  buildAllowedWechatDirectFetchUrl,
  WECHAT_ACCOUNT_NAME_HOSTS,
} from '~/server/utils/wechat-direct-fetch';

interface AccountNameQuery {
  url: string;
}

/**
 * 根据文章 url 获取公众号名称
 */
export default defineEventHandler(async event => {
  const { url: rawUrl } = getQuery<AccountNameQuery>(event);
  const url = decodeURIComponent((rawUrl || '').trim());
  const urlResult = buildAllowedWechatDirectFetchUrl(url, {
    allowedHosts: WECHAT_ACCOUNT_NAME_HOSTS,
  });

  if (!urlResult.allowed) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: '不允许的 URL：仅支持微信公众平台域名',
    });
  }

  const rawHtml = await fetch(urlResult.url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
    redirect: 'error', // 禁止跟随重定向，防止 SSRF 绕过
  }).then(res => res.text());

  const $ = cheerio.load(rawHtml);
  return $('.wx_follow_nickname:first').text().trim();
});
