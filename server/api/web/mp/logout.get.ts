/**
 * 退出登录接口
 */

import { proxyMpRequest } from '~/server/utils/proxy-request';

interface LogoutQuery {
  token: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<LogoutQuery>(event);

  const response: Response = await proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/logout',
    query: {
      t: 'wxm-logout',
      token: query.token,
      lang: 'zh_CN',
    },
  });
  return {
    statusCode: response.status,
    statusText: response.statusText,
  };
});
