import { proxyMpRequest } from '~/server/utils/proxy-request';

interface ProfileExtQuery {
  __biz: string;
  pass_ticket: string;
  key: string;
  uin: string;
  offset?: number | string;
  count?: number | string;
}

export default defineEventHandler(async event => {
  const query = getQuery<ProfileExtQuery>(event);

  const params: Record<string, string | number> = {
    action: 'getmsg',
    f: 'json',
    is_ok: 1,
    count: query.count ?? 10,
    offset: query.offset ?? 0,
    __biz: query.__biz,
    pass_ticket: query.pass_ticket,
    key: query.key,
    uin: query.uin,
  };

  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/mp/profile_ext',
    query: params,
    parseJson: true,
  }).catch(e => {
    console.error('profile_ext.get.ts 请求公众号文章列表失败');
    console.error(e);
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取文章列表失败，请重试',
      },
    };
  });
});
