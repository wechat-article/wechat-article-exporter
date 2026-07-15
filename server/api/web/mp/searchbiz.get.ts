/**
 * 搜索公众号接口
 */

import { getTokenFromStore } from '~/server/utils/CookieStore';
import { logProxyFailure, mpProxyErrorBody } from '~/server/utils/proxy-error-response';
import { proxyMpRequest } from '~/server/utils/proxy-request';
import { assertRateLimit } from '~/server/utils/rate-limit-ip';
import { MP_ENDPOINTS } from '~/server/wechat/endpoints';

interface SearchBizQuery {
  begin?: number;
  size?: number;
  keyword: string;
}

export default defineEventHandler(async event => {
  assertRateLimit(event, 'mp_searchbiz', 60);

  const token = await getTokenFromStore(event);
  if (!token) {
    return { base_resp: { ret: -1, err_msg: '未登录或登录已过期，请重新扫码登录' } };
  }

  const query = getQuery<SearchBizQuery>(event);
  const keyword = query.keyword;
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
    endpoint: MP_ENDPOINTS.searchbiz,
    query: params,
    parseJson: true,
  }).catch(e => {
    logProxyFailure('searchbiz', e, { keyword });
    return mpProxyErrorBody('搜索公众号接口失败，请重试', { code: 'SEARCHBIZ_PROXY', retryable: true });
  });
});
