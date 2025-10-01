import { saveChannel } from '~/server/kv/channel';
import type { ChannelConfig, SaveChannelResponse } from '~/types/channel';

export default defineEventHandler<Promise<SaveChannelResponse>>(async event => {
  const session = await getUserSession(event);
  if (!session || !session.user) {
    return {
      code: -1,
      msg: '未登录',
    };
  }

  const body = await readBody<ChannelConfig>(event);
  await saveChannel(session.user.email, body);

  return {
    code: 0,
    msg: '成功',
  };
});
