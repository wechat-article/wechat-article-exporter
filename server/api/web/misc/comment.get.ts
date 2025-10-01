/**
 * 获取文章评论
 */

import { proxyMpRequest } from '~/server/utils/proxy-request';

interface GetCommentQuery {
  __biz: string;
  comment_id: string;
  key: string;
  uin: string;
  pass_ticket: string;
}

export default defineEventHandler(async event => {
  const { __biz, comment_id, uin, key, pass_ticket } = getQuery<GetCommentQuery>(event);

  const params: Record<string, string | number> = {
    action: 'getcomment',
    __biz: __biz,
    comment_id: comment_id,
    uin: uin,
    key: key,
    pass_ticket: pass_ticket,
    limit: 1000,
    f: 'json',
  };

  const resp: Response = await proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/mp/appmsg_comment',
    query: params,
    parseJson: false,
  });
  return new Response(resp.body, {
    headers: {
      'content-type': 'application/json',
    },
  });
});
