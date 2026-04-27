/**
 * 获取文章列表接口
 */

import { getTokenFromEvent } from '~/server/services/api/auth-session';
import { fetchAppMsgPublishResponse } from '~/server/services/api/mp-service';

interface AppMsgPublishQuery {
  begin?: number;
  size?: number;
  id: string;
  keyword: string;
}

export default defineEventHandler(async event => {
  const token = await getTokenFromEvent(event);
  if (!token) {
    return { base_resp: { ret: -1, err_msg: '未登录或登录已过期，请重新扫码登录' } };
  }

  const query = getQuery<AppMsgPublishQuery>(event);
  const id = query.id;
  const keyword = query.keyword;
  const begin: number = query.begin || 0;
  const size: number = query.size || 5;

  const isSearching = !!keyword;

  return fetchAppMsgPublishResponse(event, {
    token,
    fakeid: id,
    keyword,
    begin,
    size,
  }).catch(e => {
    console.error(e);
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取文章列表接口失败，请重试',
      },
    };
  });
});
