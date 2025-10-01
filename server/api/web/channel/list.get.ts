import { getChannelList } from '~/server/kv/channel';
import type { GetChannelListResponse } from '~/types/channel';

export default defineEventHandler<Promise<GetChannelListResponse>>(async event => {
  const session = await getUserSession(event);
  if (!session || !session.user) {
    return {
      code: -1,
      data: [],
      msg: '未登录',
    };
  }

  const channels = await getChannelList(session.user.email);
  return {
    code: 0,
    data: channels,
    msg: '成功',
  };
});
