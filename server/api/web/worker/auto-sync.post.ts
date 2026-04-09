import { runAutoSync, checkCookieExpiry } from '~/server/utils/scheduler';

/**
 * POST /api/web/worker/auto-sync
 *
 * 手动触发定时同步任务（也可由定时器自动调用）
 * 请求体: { action?: 'sync' | 'check-cookie' }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event).catch(() => ({}));
  const action = body?.action || 'sync';

  if (action === 'check-cookie') {
    await checkCookieExpiry();
    return { success: true, message: 'Cookie 检查完成' };
  }

  // 异步执行同步任务，不阻塞响应
  runAutoSync().catch(e => {
    console.error('[auto-sync] 同步任务异常:', e);
  });

  return { success: true, message: '同步任务已启动' };
});
