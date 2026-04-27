/**
 * 获取文章评论
 */

import { fetchCommentResponse } from '~/server/services/api/mp-service';

interface GetCommentQuery {
  __biz: string;
  comment_id: string;
  key: string;
  uin: string;
  pass_ticket: string;
}

export default defineEventHandler(async event => {
  const { __biz, comment_id, uin, key, pass_ticket } = getQuery<GetCommentQuery>(event);

  const resp: Response = await fetchCommentResponse(event, {
    __biz,
    comment_id,
    uin,
    key,
    pass_ticket,
  });
  return new Response(resp.body, {
    headers: {
      'content-type': 'application/json',
    },
  });
});
