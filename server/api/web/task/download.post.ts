import { startDownloadTask } from '~/server/utils/background-runner';

export default defineEventHandler(async event => {
  const body = await readBody(event);
  const { fakeid, nickname, proxyUrl } = body;
  if (!fakeid || !nickname) {
    return { error: '参数缺失' };
  }

  await startDownloadTask(fakeid, nickname, proxyUrl);
  return { success: true };
});
