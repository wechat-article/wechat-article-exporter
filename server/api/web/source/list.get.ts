import { getSourceList } from '~/server/kv/source';
import type { GetSourceListResponse } from '~/types/source';

export default defineEventHandler<Promise<GetSourceListResponse>>(async event => {
  const session = await getUserSession(event);
  if (!session || !session.user) {
    return {
      code: -1,
      data: [],
      msg: '未登录',
    };
  }

  const sources = await getSourceList(session.user.email);
  return {
    code: 0,
    data: sources,
    msg: '成功',
  };
});
