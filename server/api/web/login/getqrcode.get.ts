import { getCookiesFromRequest } from '~/server/services/api/auth-session';
import { proxyMpRequest } from '~/server/services/api/mp-gateway';

export default defineEventHandler(async event => {
  const cookie = getCookiesFromRequest(event);

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
