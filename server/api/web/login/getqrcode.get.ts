import { getCookiesFromRequest } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';
import { assertRateLimit } from '~/server/utils/rate-limit-ip';
import { MP_ENDPOINTS } from '~/server/wechat/endpoints';

export default defineEventHandler(async event => {
  assertRateLimit(event, 'login_getqrcode', 45);

  const cookie = getCookiesFromRequest(event);

  return proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: MP_ENDPOINTS.scanLoginQrcode,
    query: {
      action: 'getqrcode',
      random: new Date().getTime(),
    },
    cookie: cookie,
  });
});
