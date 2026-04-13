import { setCookie as setResponseCookie } from 'h3';
import { cookieStore } from '~/server/utils/CookieStore';
import { getAuthKeyFromRequest } from '~/server/utils/proxy-request';

export default defineEventHandler(async event => {
  const authKey = getAuthKeyFromRequest(event);

  // 这里进行服务器验证，确定请求中的 auth-key 是否还有效
  const accountCookie = authKey ? await cookieStore.getAccountCookie(authKey) : null;

  if (authKey && accountCookie && !accountCookie.isExpired) {
    return {
      code: 0,
      data: authKey,
    };
  } else {
    if (authKey) {
      setResponseCookie(event, 'auth-key', 'EXPIRED', {
        path: '/',
        maxAge: 0,
        secure: true,
        httpOnly: true,
        sameSite: 'lax',
      });
    }

    return {
      code: -1,
      msg: 'AuthKey not found',
    };
  }
});
