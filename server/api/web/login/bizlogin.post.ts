import dayjs from 'dayjs';
import { request } from '#shared/utils/request';
import { getCookieFromResponse, getCookiesFromRequest } from '~/server/utils/CookieStore';
import { cookieStore } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';

export default defineEventHandler(async event => {
  const cookie = getCookiesFromRequest(event);

  const payload: Record<string, string | number> = {
    userlang: 'zh_CN',
    redirect_url: '',
    cookie_forbidden: 0,
    cookie_cleaned: 0,
    plugin_used: 0,
    login_type: 3,
    token: '',
    lang: 'zh_CN',
    f: 'json',
    ajax: 1,
  };

  const response: Response = await proxyMpRequest({
    event: event,
    method: 'POST',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/bizlogin',
    query: {
      action: 'login',
    },
    body: payload,
    cookie: cookie,
    action: 'login', // 有这个标志就会把微信原始响应中的所有 set-cookie 存储在 CookieStore 中，并返回给客户端一个唯一的cookie: auth-key=xxx
  });

  // 从响应中取出唯一的 set-cookie (即上一步 `action=login` 标志所设置的 auth-key=xxx)
  const authKey = getCookieFromResponse('auth-key', response);
  if (!authKey) {
    return {
      err: '登录失败，请稍后重试',
    };
  }

  const { nick_name, head_img } = await request(`/api/web/mp/info`, {
    headers: {
      Cookie: `auth-key=${authKey}`,
    },
  });
  if (!nick_name) {
    return {
      err: '获取公众号昵称失败，请稍后重试',
    };
  }

  const accountCookie = await cookieStore.getAccountCookie(authKey);
  const expiresAt = accountCookie?.expiresAt || dayjs().add(4, 'days').valueOf();

  const body = JSON.stringify({
    nickname: nick_name,
    avatar: head_img,
    expires: new Date(expiresAt).toString(),
  });
  const headers = new Headers(response.headers);
  headers.set('Content-Length', new TextEncoder().encode(body).length.toString());
  return new Response(body, { headers: headers });
});
