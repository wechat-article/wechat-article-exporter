import { fetchAuthorInfoResponse } from '~/server/services/api/mp-service';

interface AuthorInfoQuery {
  fakeid: string;
}

export default defineEventHandler(async event => {
  const { fakeid } = getQuery<AuthorInfoQuery>(event);

  return fetchAuthorInfoResponse(event, {
    fakeid,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取公众号主体信息接口失败，请重试',
      },
    };
  });
});
