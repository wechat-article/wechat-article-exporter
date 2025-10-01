/**
 * 获取绑定在同一个微信下的所有公众号列表
 */

import { proxyMpRequest } from '~/server/utils/proxy-request';

interface GetAccountListQuery {
  token: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<GetAccountListQuery>(event);
  const params = {
    action: 'get_acct_list',
    fingerprint: 'd468716e2b2e683b61ad4fd9b3b5d91d',
    token: query.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  };

  return proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/switchacct',
    query: params,
    parseJson: true,
  }).catch(e => {
    console.error(e);
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取账号列表接口失败，请重试',
      },
    };
  });
});
