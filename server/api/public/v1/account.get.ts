import { getTokenFromStore } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';
import { enforceRateLimit } from '~/server/utils/rate-limit';

interface SearchBizQuery {
  begin?: number;
  size?: number;
  keyword: string;
}

export default defineEventHandler(async event => {
  // 分级限流（查询类）：游客 5 次/分钟（按 IP），会员 100 次/分钟（按 X-Api-Token）
  await enforceRateLimit(event, 'query');

  const token = await getTokenFromStore(event);

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
        err_msg: '搜索公众号接口失败，请稍后重试',
      },
    };
  });
});
