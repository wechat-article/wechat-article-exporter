import { getManualSyncJobStatus, listManualSyncJobStatuses } from '~/server/utils/manual-sync-jobs';

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const jobId = typeof query.jobId === 'string' ? query.jobId : undefined;
  const jobIds = typeof query.jobIds === 'string'
    ? query.jobIds.split(',').map(item => item.trim()).filter(Boolean)
    : [];
  const all = query.all === '1' || query.all === 'true';

  if (all || jobIds.length > 0) {
    return listManualSyncJobStatuses(jobIds);
  }

  const status = getManualSyncJobStatus(jobId);

  if (!status) {
    throw createError({
      statusCode: 404,
      message: '同步任务不存在',
    });
  }

  return status;
});