/**
 * 搜索公众号文章列表接口
 */

import { logProxyFailure, mpProxyErrorBody } from '~/server/utils/proxy-error-response';
import { proxyMpRequest } from '~/server/utils/proxy-request';
import { MP_ENDPOINTS } from '~/server/wechat/endpoints';

interface SearchBizQuery {
  begin?: number;
  size?: number;
  id: string;
  uin: string;
  key: string;
  pass_ticket: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<SearchBizQuery>(event);
  const begin: number = query.begin || 0;
  const size: number = query.size || 10;

  const params: Record<string, string | number> = {
    action: 'getmsg',
    __biz: query.id,
    offset: begin,
    count: size,
    uin: query.uin,
    key: query.key,
    pass_ticket: query.pass_ticket,
    f: 'json',
    is_ok: '1',
    scene: '124',
  };

  return proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: MP_ENDPOINTS.profileExt,
    query: params,
    parseJson: true,
  }).catch(e => {
    logProxyFailure('profile_ext_getmsg', e, { id: query.id });
    return mpProxyErrorBody('获取公众号文章列表失败，请重试', { code: 'PROFILE_EXT', retryable: true });
  });
});
