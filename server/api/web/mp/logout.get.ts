/**
 * 退出登录接口
 */

import { parseCookies } from 'h3';
import { cookieStore, getTokenFromStore } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';

export default defineEventHandler(async event => {
  const authKey = getRequestHeader(event, 'X-Auth-Key') || parseCookies(event)['auth-key'];
  const token = await getTokenFromStore(event);

  if (token) {
    await proxyMpRequest({
      event: event,
      method: 'GET',
      endpoint: 'https://mp.weixin.qq.com/cgi-bin/logout',
      query: {
        t: 'wxm-logout',
        token: token,
        lang: 'zh_CN',
      },
    }).catch(() => {});
  }

  if (authKey) {
    cookieStore.removeCookie(authKey);
  }

  return { statusCode: 200, statusText: 'OK' };
});
