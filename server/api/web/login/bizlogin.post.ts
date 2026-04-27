import dayjs from 'dayjs';
import { getCookiesFromRequest, getCookieValueFromResponse } from '~/server/services/api/auth-session';
import { proxyMpRequest } from '~/server/services/api/mp-gateway';
import { fetchMpHomeInfoByAuthKey } from '~/server/services/api/mp-service';

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
    action: 'login', // 该流程会写入登录态并返回 auth-key cookie
  });

  // 从登录响应里提取 auth-key cookie
  const authKey = getCookieValueFromResponse('auth-key', response);
  if (!authKey) {
    let detail = '登录失败，请稍后重试';
    try {
      const loginResponse = await response.clone().json();
      const upstreamMessage = loginResponse?.base_resp?.err_msg;
      if (typeof upstreamMessage === 'string' && upstreamMessage.trim()) {
        detail = upstreamMessage;
      }
    } catch {
      try {
        const rawText = await response.clone().text();
        if (rawText.trim()) {
          detail = rawText.trim();
        }
      } catch {
        // Keep the default fallback message.
      }
    }

    return {
      err: detail,
    };
  }

  const info = await fetchMpHomeInfoByAuthKey(event, authKey);
  const nick_name = info?.nick_name || '';
  const head_img = info?.head_img || '';
  if (!nick_name) {
    return {
      err: '获取公众号昵称失败，请稍后重试',
    };
  }

  const body = JSON.stringify({
    nickname: nick_name,
    avatar: head_img,
    expires: dayjs().add(4, 'days').toString(),
  });
  const headers = new Headers(response.headers);
  headers.set('Content-Length', new TextEncoder().encode(body).length.toString());
  return new Response(body, { headers: headers });
});
