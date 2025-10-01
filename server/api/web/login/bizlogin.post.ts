import { proxyMpRequest } from '~/server/utils/proxy-request';
import { getCookieFromRequest, AccountCookie, cookieStore } from '~/server/utils/CookieStore';
import dayjs from 'dayjs';

export default defineEventHandler(async event => {
  const cookie = getCookieFromRequest(event);

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
  const respCookie = new AccountCookie(response.headers.getSetCookie());
  const authKeyCookie = respCookie.get('auth-key');
  if (!authKeyCookie) {
    return {
      err: '登录失败，请稍后重试',
    };
  }

  const { redirect_url } = await response.json();
  const token = new URL(`http://localhost${redirect_url}`).searchParams.get('token');
  const { nick_name, head_img } = await $fetch(`/api/web/mp/info?token=${token}`, {
    headers: {
      Cookie: respCookie.toString(),
    },
  });
  if (!nick_name || !token) {
    return {
      err: '获取公众号昵称失败，请稍后重试',
    };
  }

  // 为了与对外接口统一，需要将 token 与 authKey 关联
  cookieStore.bindToken(authKeyCookie['value'] as string, token);

  const body = JSON.stringify({
    nickname: nick_name,
    avatar: head_img,
    token: token,
    expires: dayjs().add(3, 'days').toString(),
  });
  const headers = new Headers(response.headers);
  headers.set('Content-Length', new TextEncoder().encode(body).length.toString());
  return new Response(body, { headers: headers });
});
