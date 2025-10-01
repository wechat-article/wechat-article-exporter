import { deleteChannel } from '~/server/kv/channel';
import type { SaveChannelResponse } from '~/types/channel';

interface Query {
  id: string;
}

export default defineEventHandler<Promise<SaveChannelResponse>>(async event => {
  const { id } = getQuery<Query>(event);

  const session = await getUserSession(event);
  if (!session || !session.user) {
    return {
      code: -1,
      msg: '未登录',
    };
  }

  const success = await deleteChannel(session.user.email, id);
  if (success) {
    return {
      code: 0,
      msg: '删除成功',
    };
  } else {
    return {
      code: -1,
      msg: '配置不存在',
    };
  }
});
