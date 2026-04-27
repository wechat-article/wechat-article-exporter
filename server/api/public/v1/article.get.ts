import { getTokenFromEvent } from '~/server/services/api/auth-session';
import { extractPublishedArticles } from '~/server/services/api/mp-core';
import { fetchAppMsgPublishResponse } from '~/server/services/api/mp-service';

interface AppMsgPublishQuery {
  fakeid: string;
  begin?: number;
  size?: number;
  keyword?: string;
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

  const query = getQuery<AppMsgPublishQuery>(event);
  if (!query.fakeid) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'fakeid不能为空',
      },
    };
  }
  const fakeid = query.fakeid;
  const keyword = query.keyword || '';
  const begin: number = query.begin || 0;
  const size: number = query.size || 5;

  const resp = await fetchAppMsgPublishResponse(event, {
    token,
    fakeid,
    keyword,
    begin,
    size,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取文章列表接口失败，请重试',
      },
    };
  });

  if (resp.base_resp.ret === 0) {
    const articles = extractPublishedArticles(resp);
    return {
      base_resp: resp.base_resp,
      articles: articles,
    };
  }
  return resp;
});
