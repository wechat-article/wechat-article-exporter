import { getTokenFromEvent } from '~/server/services/api/auth-session';
import { fetchSearchBizResponse } from '~/server/services/api/mp-service';

interface SearchBizQuery {
  begin?: number;
  size?: number;
  keyword: string;
}

export default defineEventHandler(async event => {
  const token = await getTokenFromEvent(event);

  if (!token) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '认证信息无效',
      },
    };
  }

  const query = getQuery<SearchBizQuery>(event);
  if (!query.keyword) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'keyword不能为空',
      },
    };
  }

  const keyword = query.keyword;
  const begin: number = query.begin || 0;
  const size: number = query.size || 5;

  return fetchSearchBizResponse(event, {
    token,
    keyword,
    begin,
    size,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '搜索公众号接口失败，请稍后重试',
      },
    };
  });
});
