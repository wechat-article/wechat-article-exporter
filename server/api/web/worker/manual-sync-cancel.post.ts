import { cancelManualSyncJob } from '~/server/utils/manual-sync-jobs';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const jobId = body?.jobId;

  if (!jobId || typeof jobId !== 'string') {
    throw createError({
      statusCode: 400,
      message: '缺少 jobId 参数',
    });
  }

  const status = cancelManualSyncJob(jobId);
  if (!status) {
    throw createError({
      statusCode: 404,
      message: '同步任务不存在',
    });
  }

  return status;
});