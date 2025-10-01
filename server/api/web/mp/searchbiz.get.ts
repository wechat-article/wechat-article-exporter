/**
 * 搜索公众号接口
 */

import { proxyMpRequest } from '~/server/utils/proxy-request';

interface SearchBizQuery {
  begin?: number;
  size?: number;
  keyword: string;
  token: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<SearchBizQuery>(event);
  const keyword = query.keyword;
  const token = query.token;
  const begin: number = query.begin || 0;
  const size: number = query.size || 5;

  const params: Record<string, string | number> = {
    action: 'search_biz',
    begin: begin,
    count: size,
    query: keyword,
    token: token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  };

  return proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/searchbiz',
    query: params,
    parseJson: true,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '搜索公众号接口失败，请重试',
      },
    };
  });
});
