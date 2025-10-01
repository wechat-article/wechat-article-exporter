import { proxyMpRequest } from '~/server/utils/proxy-request';
import { getCookieFromRequest } from '~/server/utils/CookieStore';

export default defineEventHandler(async event => {
  const cookie = getCookieFromRequest(event);

  return proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/scanloginqrcode',
    query: {
      action: 'getqrcode',
      random: new Date().getTime(),
    },
    cookie: cookie,
  });
});
