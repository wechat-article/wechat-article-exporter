/**
 * 退出登录接口
 */

import { parseCookies, setCookie as setResponseCookie } from 'h3';
import { cookieStore, getTokenFromStore } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';

export default defineEventHandler(async event => {
  const authKey = getRequestHeader(event, 'X-Auth-Key') || parseCookies(event)['auth-key'];

  const token = await getTokenFromStore(event);

  // 即使 token 不存在（如服务端 session 已过期），也要清理所有状态
  if (token) {
    try {
      await proxyMpRequest({
        event: event,
        method: 'GET',
        endpoint: 'https://mp.weixin.qq.com/cgi-bin/logout',
        query: {
          t: 'wxm-logout',
          token: token,
          lang: 'zh_CN',
        },
      });
    } catch (e) {
      // 微信登出失败不影响本地登出
      console.warn('微信平台登出请求失败:', e);
    }
  }

  // 清理服务端 session 缓存
  if (authKey) {
    await cookieStore.removeCookie(authKey);
  }

  // 清除浏览器的 auth-key HttpOnly cookie
  setResponseCookie(event, 'auth-key', 'EXPIRED', {
    path: '/',
    maxAge: 0,
    secure: true,
    httpOnly: true,
  });

  return {
    statusCode: 200,
    statusText: '已退出登录',
  };
});
