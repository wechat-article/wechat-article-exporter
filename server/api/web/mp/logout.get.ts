/**
 * 退出登录接口
 */

import { getTokenFromEvent, revokeSessionFromEvent } from '~/server/services/api/auth-session';
import { proxyMpRequest } from '~/server/services/api/mp-gateway';

export default defineEventHandler(async event => {
  const token = await getTokenFromEvent(event);
  if (!token) {
    return { statusCode: 401, statusText: '未登录或登录已过期，请重新扫码登录' };
  }

  const response: Response = await proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/logout',
    query: {
      t: 'wxm-logout',
      token: token,
      lang: 'zh_CN',
    },
  });

  await revokeSessionFromEvent(event);

  return {
    statusCode: response.status,
    statusText: response.statusText,
  };
});
