import { startManualSyncJob } from '~/server/utils/manual-sync-jobs';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const fakeid = body?.fakeid;
  const nickname = body?.nickname;
  const roundHeadImg = body?.roundHeadImg;
  const syncToTimestamp = Number(body?.syncToTimestamp || 0);

  if (!fakeid || typeof fakeid !== 'string') {
    throw createError({
      statusCode: 400,
      message: '缺少 fakeid 参数',
    });
  }

  if (!nickname || typeof nickname !== 'string') {
    throw createError({
      statusCode: 400,
      message: '缺少 nickname 参数',
    });
  }

  if (!Number.isFinite(syncToTimestamp) || syncToTimestamp <= 0) {
    throw createError({
      statusCode: 400,
      message: '缺少有效的 syncToTimestamp 参数',
    });
  }

  try {
    const status = await startManualSyncJob({
      fakeid,
      nickname,
      roundHeadImg,
      syncToTimestamp,
    });
    return {
      jobId: status.jobId,
      status,
    };
  } catch (error: any) {
    throw createError({
      statusCode: 409,
      message: error?.message || '手动同步任务启动失败',
    });
  }
});