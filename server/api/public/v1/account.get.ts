import { getPool } from '~/server/db/postgres';
import { AccountCookie, getTokenFromStore } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';

interface SearchBizQuery {
  begin?: number;
  size?: number;
  keyword: string;
}

export default defineEventHandler(async event => {
  let token = await getTokenFromStore(event);
  let cookie: string | null = null;

  if (!token) {
    const pool = getPool();
    const now = Math.round(Date.now() / 1000);
    const sessionRes = await pool.query(
      `SELECT auth_key, token, cookies FROM session WHERE expires_at > $1 ORDER BY created_at DESC LIMIT 1`,
      [now]
    );
    const session = sessionRes.rows[0];
    if (session?.token && session?.cookies) {
      token = session.token;
      cookie = AccountCookie.create(session.token, session.cookies).toString();
    }
  }

  if (!token) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '未登录或登录已过期',
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
    cookie: cookie || undefined,
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
