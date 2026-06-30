import { getAuthKeyFromRequest } from '~/server/utils/proxy-request';
import { startSyncTask } from '~/server/utils/background-runner';

export default defineEventHandler(async event => {
  const authKey = getAuthKeyFromRequest(event);
  if (!authKey) {
    return { error: '未登录或登录已过期，请先扫码登录' };
  }

  const body = await readBody(event);
  const { fakeid, nickname } = body;
  if (!fakeid || !nickname) {
    return { error: '参数缺失' };
  }

  await startSyncTask(fakeid, nickname, authKey);
  return { success: true };
});
