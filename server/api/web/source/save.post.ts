import { saveSource } from '~/server/kv/source';
import type { SubscribeSourceConfig, SaveSourceResponse } from '~/types/source';

export default defineEventHandler<Promise<SaveSourceResponse>>(async event => {
  const session = await getUserSession(event);
  if (!session || !session.user) {
    return {
      code: -1,
      msg: '未登录',
    };
  }

  const body = await readBody<SubscribeSourceConfig>(event);
  await saveSource(session.user.email, body);

  return {
    code: 0,
    msg: '成功',
  };
});
