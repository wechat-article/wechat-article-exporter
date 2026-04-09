import { Cron } from 'croner';
import { runAutoSync } from '~/server/utils/scheduler';

// 模块级变量，防止开发模式热重载时创建重复的 cron 实例
let _cronJob: Cron | null = null;

export default defineNitroPlugin(() => {
  const enabled = process.env.SCHEDULER_ENABLED === 'true';
  if (!enabled) {
    console.log('[scheduler] 定时任务未启用 (SCHEDULER_ENABLED != true)');
    return;
  }

  // 停掉上一次热重载遗留的 cron 实例
  if (_cronJob) {
    _cronJob.stop();
    _cronJob = null;
  }

  const cronExpr = process.env.SCHEDULER_CRON || '0 8 * * *';

  _cronJob = new Cron(cronExpr, { timezone: 'Asia/Shanghai' }, async () => {
    console.log(`[scheduler] Cron 触发: ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`);
    try {
      await runAutoSync();
    } catch (e) {
      console.error('[scheduler] 定时任务执行异常:', e);
    }
  });

  const nextRun = _cronJob.nextRun();
  const nextRunStr = nextRun ? nextRun.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '未知';
  console.log(`[scheduler] 定时任务已启动，Cron: "${cronExpr}"，下次执行: ${nextRunStr}`);
});
