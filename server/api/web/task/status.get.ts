import { syncTasks, downloadTasks } from '~/server/utils/background-runner';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const fakeid = query.fakeid as string;
  if (!fakeid) {
    return { error: '参数缺失' };
  }

  const sync = syncTasks.get(fakeid) || { status: 'idle', progress: 0, total: 0 };
  const download = downloadTasks.get(fakeid) || { status: 'idle', progress: 0, total: 0 };

  return {
    sync,
    download,
  };
});
