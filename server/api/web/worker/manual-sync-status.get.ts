import { getManualSyncJobStatus } from '~/server/utils/manual-sync-jobs';

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const jobId = typeof query.jobId === 'string' ? query.jobId : undefined;
  const status = getManualSyncJobStatus(jobId);

  if (!status) {
    throw createError({
      statusCode: 404,
      message: '同步任务不存在',
    });
  }

  return status;
});