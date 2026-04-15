import { randomUUID } from 'node:crypto';
import {
  type ArticleExportProgress,
  type ArticleExportRetryProgress,
  type ExportSource,
} from '~/server/utils/docx-generator';
import {
  getAccountInfoRecord,
  updateAccountSyncStatus,
} from '~/server/utils/account-info';
import {
  getActiveSession,
  syncAccountByRange,
  type SyncAccountResult,
  type SyncPageProgress,
  type SyncRetryProgress,
} from '~/server/utils/sync-engine';
import { ACCOUNT_SYNC_STATUS } from '~/shared/utils/account-sync-status';

export type SyncQueueSource = 'interface' | 'manual' | 'schedule';
export type QueueRuntimeStage = 'queued' | 'syncing' | 'exporting' | 'finalizing' | 'completed' | 'failed' | 'cancelled';

interface QueueSubscriber {
  onStageChange?: (stage: QueueRuntimeStage) => void | Promise<void>;
  onPageFetched?: (progress: SyncPageProgress) => void | Promise<void>;
  onExportArticleStart?: (progress: ArticleExportProgress) => void | Promise<void>;
  onRetry?: (progress: SyncRetryProgress | ArticleExportRetryProgress) => void | Promise<void>;
  isCancelled?: () => boolean;
}

export interface EnqueueAccountSyncInput extends QueueSubscriber {
  source: SyncQueueSource;
  fakeid: string;
  nickname: string;
  roundHeadImg?: string | null;
  syncToTimestamp: number;
  exportDocs: boolean;
}

export interface AccountSyncTaskHandle {
  id: string;
  fakeid: string;
  promise: Promise<SyncAccountResult>;
}

interface QueueTask {
  id: string;
  fakeid: string;
  nickname: string;
  roundHeadImg?: string | null;
  priority: number;
  source: SyncQueueSource;
  syncToTimestamp: number;
  exportDocs: boolean;
  order: number;
  subscribers: QueueSubscriber[];
  promise: Promise<SyncAccountResult>;
  resolve: (result: SyncAccountResult) => void;
}

const PRIORITY: Record<SyncQueueSource, number> = {
  interface: 0,
  manual: 1,
  schedule: 2,
};

const taskByFakeid = new Map<string, QueueTask>();
const pendingTasks: QueueTask[] = [];
let activeTask: QueueTask | null = null;
let taskOrder = 0;
let queueDraining = false;

function toExportSource(source: SyncQueueSource): ExportSource {
  if (source === 'manual') {
    return 'manual-sync';
  }

  if (source === 'schedule') {
    return 'schedule';
  }

  return 'interface-sync';
}

function normalizeSyncToTimestamp(currentValue: number, nextValue: number): number {
  const left = Number(currentValue || 0);
  const right = Number(nextValue || 0);
  if (left <= 0 || right <= 0) {
    return 0;
  }

  return Math.min(left, right);
}

function isTaskCancelled(task: QueueTask): boolean {
  return task.subscribers.length > 0 && task.subscribers.every(subscriber => subscriber.isCancelled?.() ?? false);
}

async function notifyStage(task: QueueTask, stage: QueueRuntimeStage) {
  for (const subscriber of task.subscribers) {
    await subscriber.onStageChange?.(stage);
  }
}

async function notifyPageFetched(task: QueueTask, progress: SyncPageProgress) {
  for (const subscriber of task.subscribers) {
    await subscriber.onPageFetched?.(progress);
  }
}

async function notifyExportStart(task: QueueTask, progress: ArticleExportProgress) {
  for (const subscriber of task.subscribers) {
    await subscriber.onExportArticleStart?.(progress);
  }
}

async function notifyRetry(task: QueueTask, progress: SyncRetryProgress | ArticleExportRetryProgress) {
  for (const subscriber of task.subscribers) {
    await subscriber.onRetry?.(progress);
  }
}

function sortPendingTasks() {
  pendingTasks.sort((left, right) => {
    if (left.priority !== right.priority) {
      return left.priority - right.priority;
    }
    return left.order - right.order;
  });
}

async function runTask(task: QueueTask): Promise<SyncAccountResult> {
  const account = await getAccountInfoRecord(task.fakeid, { includeDisabled: true });
  if (!account) {
    return {
      fakeid: task.fakeid,
      nickname: task.nickname,
      success: false,
      articleCount: 0,
      failedUrls: [],
      generated: 0,
      skipped: 0,
      failed: 0,
      error: '公众号不存在',
    };
  }

  if (account.isDelete) {
    return {
      fakeid: task.fakeid,
      nickname: task.nickname,
      success: false,
      articleCount: 0,
      failedUrls: [],
      generated: 0,
      skipped: 0,
      failed: 0,
      error: '公众号已禁用',
    };
  }

  if (isTaskCancelled(task)) {
    return {
      fakeid: task.fakeid,
      nickname: task.nickname,
      success: false,
      articleCount: 0,
      failedUrls: [],
      generated: 0,
      skipped: 0,
      failed: 0,
      error: 'cancelled',
    };
  }

  const session = await getActiveSession();
  if (!session) {
    return {
      fakeid: task.fakeid,
      nickname: task.nickname,
      success: false,
      articleCount: 0,
      failedUrls: [],
      generated: 0,
      skipped: 0,
      failed: 0,
      error: '未登录或登录已过期，请重新扫码登录',
    };
  }

  return await syncAccountByRange({
    authKey: session.authKey,
    token: session.token,
    cookie: session.cookie,
    fakeid: task.fakeid,
    nickname: task.nickname,
    roundHeadImg: task.roundHeadImg,
    syncToTimestamp: task.syncToTimestamp,
    source: toExportSource(task.source),
    exportDocs: task.exportDocs,
    isCancelled: () => isTaskCancelled(task),
    onStageChange: async (stage) => {
      await notifyStage(task, stage);
    },
    onPageFetched: async (progress) => {
      await notifyPageFetched(task, progress);
    },
    onExportArticleStart: async (progress) => {
      await notifyExportStart(task, progress);
    },
    onRetry: async (progress) => {
      await notifyRetry(task, progress);
    },
  });
}

async function drainQueue() {
  if (queueDraining) {
    return;
  }

  queueDraining = true;
  try {
    while (!activeTask && pendingTasks.length > 0) {
      const nextTask = pendingTasks.shift() || null;
      if (!nextTask) {
        break;
      }

      activeTask = nextTask;
      await updateAccountSyncStatus(nextTask.fakeid, ACCOUNT_SYNC_STATUS.SYNCING);
      await notifyStage(nextTask, 'syncing');

      let result: SyncAccountResult;
      try {
        result = await runTask(nextTask);
      } catch (error: any) {
        result = {
          fakeid: nextTask.fakeid,
          nickname: nextTask.nickname,
          success: false,
          articleCount: 0,
          failedUrls: [],
          generated: 0,
          skipped: 0,
          failed: 0,
          error: error?.message || 'unknown error',
        };
      }

      const terminalStage: QueueRuntimeStage = result.error === 'cancelled'
        ? 'cancelled'
        : result.success
          ? 'completed'
          : 'failed';
      await updateAccountSyncStatus(
        nextTask.fakeid,
        result.success ? ACCOUNT_SYNC_STATUS.SUCCESS : ACCOUNT_SYNC_STATUS.FAILED,
      );
      await notifyStage(nextTask, terminalStage);

      taskByFakeid.delete(nextTask.fakeid);
      activeTask = null;
      nextTask.resolve(result);
    }
  } finally {
    queueDraining = false;
    if (!activeTask && pendingTasks.length > 0) {
      void drainQueue();
    }
  }
}

export async function enqueueAccountSync(input: EnqueueAccountSyncInput): Promise<AccountSyncTaskHandle> {
  const account = await getAccountInfoRecord(input.fakeid, { includeDisabled: true });
  if (!account) {
    throw new Error('公众号不存在');
  }

  if (account.isDelete) {
    throw new Error('公众号已禁用');
  }

  const existingTask = taskByFakeid.get(input.fakeid);
  if (existingTask) {
    existingTask.priority = Math.min(existingTask.priority, PRIORITY[input.source]);
    if (PRIORITY[input.source] < PRIORITY[existingTask.source]) {
      existingTask.source = input.source;
    }
    existingTask.nickname = input.nickname || existingTask.nickname;
    existingTask.roundHeadImg = input.roundHeadImg || existingTask.roundHeadImg;
    existingTask.syncToTimestamp = normalizeSyncToTimestamp(existingTask.syncToTimestamp, input.syncToTimestamp);
    existingTask.exportDocs = existingTask.exportDocs || input.exportDocs;
    existingTask.subscribers.push({
      onStageChange: input.onStageChange,
      onPageFetched: input.onPageFetched,
      onExportArticleStart: input.onExportArticleStart,
      onRetry: input.onRetry,
      isCancelled: input.isCancelled,
    });

    if (activeTask?.id !== existingTask.id) {
      await updateAccountSyncStatus(existingTask.fakeid, ACCOUNT_SYNC_STATUS.QUEUED);
      sortPendingTasks();
    }

    return {
      id: existingTask.id,
      fakeid: existingTask.fakeid,
      promise: existingTask.promise,
    };
  }

  let resolveTask: (result: SyncAccountResult) => void = () => {};
  const promise = new Promise<SyncAccountResult>((resolve) => {
    resolveTask = resolve;
  });

  const task: QueueTask = {
    id: randomUUID(),
    fakeid: input.fakeid,
    nickname: input.nickname,
    roundHeadImg: input.roundHeadImg,
    priority: PRIORITY[input.source],
    source: input.source,
    syncToTimestamp: Number(input.syncToTimestamp || 0),
    exportDocs: input.exportDocs,
    order: ++taskOrder,
    subscribers: [{
      onStageChange: input.onStageChange,
      onPageFetched: input.onPageFetched,
      onExportArticleStart: input.onExportArticleStart,
      onRetry: input.onRetry,
      isCancelled: input.isCancelled,
    }],
    promise,
    resolve: resolveTask,
  };

  taskByFakeid.set(task.fakeid, task);
  pendingTasks.push(task);
  sortPendingTasks();
  await updateAccountSyncStatus(task.fakeid, ACCOUNT_SYNC_STATUS.QUEUED);
  await notifyStage(task, 'queued');
  void drainQueue();

  return {
    id: task.id,
    fakeid: task.fakeid,
    promise: task.promise,
  };
}