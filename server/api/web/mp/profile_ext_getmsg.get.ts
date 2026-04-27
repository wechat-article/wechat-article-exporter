/**
 * 搜索公众号文章列表接口
 */

import { fetchProfileExtGetMsgResponse } from '~/server/services/api/mp-service';

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

  return fetchProfileExtGetMsgResponse(event, {
    id: query.id,
    begin,
    size,
    uin: query.uin,
    key: query.key,
    pass_ticket: query.pass_ticket,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '搜索公众号接口失败，请重试',
      },
    };
  });
});
