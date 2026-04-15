import { randomUUID } from 'node:crypto';
import { enqueueAccountSync } from '~/server/utils/account-sync-queue';
import type { SyncRetryProgress } from '~/server/utils/sync-engine';
import type { ArticleExportProgress, ArticleExportRetryProgress } from '~/server/utils/docx-generator';

export type ManualSyncStage = 'queued' | 'syncing' | 'exporting' | 'finalizing' | 'completed' | 'failed' | 'cancelled' | 'cancelling';

export interface ManualSyncJobStatus {
  jobId: string;
  fakeid: string;
  nickname: string;
  stage: ManualSyncStage;
  syncToTimestamp: number;
  startedAt: number;
  updatedAt: number;
  cancelRequested: boolean;
  pageNumber: number;
  begin: number;
  totalCount: number;
  currentPageArticleCount: number;
  currentPageFilteredCount: number;
  currentArticleTitle: string | null;
  currentArticleUrl: string | null;
  currentArticleIndex: number;
  currentArticleTotal: number;
  retrying: boolean;
  retryMessage: string | null;
  articleCount: number;
  generated: number;
  skipped: number;
  failed: number;
  failedUrls: string[];
  error?: string;
}

interface StartManualSyncInput {
  fakeid: string;
  nickname: string;
  roundHeadImg?: string | null;
  syncToTimestamp: number;
}

const jobs = new Map<string, ManualSyncJobStatus>();

function isTerminalStage(stage: ManualSyncStage) {
  return stage === 'completed' || stage === 'failed' || stage === 'cancelled';
}

function touch(status: ManualSyncJobStatus, patch: Partial<ManualSyncJobStatus>) {
  Object.assign(status, patch, { updatedAt: Date.now() });
}

function normalizePageNumber(pageNumber: number | null | undefined): number {
  return Math.max(1, Number(pageNumber || 0));
}

export async function startManualSyncJob(input: StartManualSyncInput): Promise<ManualSyncJobStatus> {
  const now = Date.now();
  const jobId = randomUUID();
  const status: ManualSyncJobStatus = {
    jobId,
    fakeid: input.fakeid,
    nickname: input.nickname,
    stage: 'queued',
    syncToTimestamp: input.syncToTimestamp,
    startedAt: now,
    updatedAt: now,
    cancelRequested: false,
    pageNumber: 1,
    begin: 0,
    totalCount: 0,
    currentPageArticleCount: 0,
    currentPageFilteredCount: 0,
    currentArticleTitle: null,
    currentArticleUrl: null,
    currentArticleIndex: 0,
    currentArticleTotal: 0,
    retrying: false,
    retryMessage: null,
    articleCount: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    failedUrls: [],
  };

  jobs.set(jobId, status);

  let handle;
  try {
    handle = await enqueueAccountSync({
      source: 'manual',
      fakeid: input.fakeid,
      nickname: input.nickname,
      roundHeadImg: input.roundHeadImg,
      syncToTimestamp: input.syncToTimestamp,
      exportDocs: true,
      isCancelled: () => status.cancelRequested,
      onStageChange: async (stage) => {
        if (stage === 'queued') {
          touch(status, { stage: 'queued', retrying: false, retryMessage: null });
          return;
        }

        if (stage === 'syncing' || stage === 'exporting' || stage === 'finalizing') {
          touch(status, {
            stage: status.cancelRequested ? 'cancelling' : stage,
            retrying: false,
            retryMessage: null,
          });
          return;
        }

        if (stage === 'cancelled') {
          touch(status, {
            stage: 'cancelled',
            retrying: false,
            retryMessage: null,
          });
        }
      },
      onPageFetched: async (progress) => {
        touch(status, {
          stage: status.cancelRequested ? 'cancelling' : 'syncing',
          pageNumber: normalizePageNumber(progress.pageNumber),
          begin: progress.begin,
          totalCount: progress.totalCount,
          currentPageArticleCount: progress.articleCount,
          currentPageFilteredCount: progress.filteredCount,
          currentArticleTitle: null,
          currentArticleUrl: null,
          currentArticleIndex: 0,
          currentArticleTotal: 0,
          retrying: false,
          retryMessage: null,
        });
      },
      onExportArticleStart: async (progress: ArticleExportProgress) => {
        touch(status, {
          stage: status.cancelRequested ? 'cancelling' : 'exporting',
          currentArticleTitle: progress.title,
          currentArticleUrl: progress.url,
          currentArticleIndex: progress.index,
          currentArticleTotal: progress.total,
          retrying: false,
          retryMessage: null,
        });
      },
      onRetry: async (progress: SyncRetryProgress | ArticleExportRetryProgress) => {
        if (progress.stage === 'syncing') {
          touch(status, {
            stage: status.cancelRequested ? 'cancelling' : 'syncing',
            pageNumber: normalizePageNumber(progress.pageNumber),
            begin: progress.begin,
            currentArticleTitle: null,
            currentArticleUrl: null,
            currentArticleIndex: 0,
            currentArticleTotal: 0,
            retrying: true,
            retryMessage: progress.message,
          });
          return;
        }

        touch(status, {
          stage: status.cancelRequested ? 'cancelling' : 'exporting',
          currentArticleTitle: progress.title,
          currentArticleUrl: progress.url,
          currentArticleIndex: progress.index,
          currentArticleTotal: progress.total,
          retrying: true,
          retryMessage: progress.message,
        });
      },
    });
  } catch (error) {
    jobs.delete(jobId);
    throw error;
  }

  void handle.promise.then((result) => {
    if (result.error === 'cancelled') {
      touch(status, {
        stage: 'cancelled',
        articleCount: result.articleCount,
        generated: result.generated,
        skipped: result.skipped,
        failed: result.failed,
        failedUrls: result.failedUrls,
        currentArticleTitle: null,
        currentArticleUrl: null,
        currentArticleIndex: 0,
        currentArticleTotal: 0,
        retrying: false,
        retryMessage: null,
      });
      return;
    }

    if (!result.success) {
      touch(status, {
        stage: 'failed',
        articleCount: result.articleCount,
        generated: result.generated,
        skipped: result.skipped,
        failed: result.failed,
        failedUrls: result.failedUrls,
        error: result.error,
        currentArticleTitle: null,
        currentArticleUrl: null,
        currentArticleIndex: 0,
        currentArticleTotal: 0,
        retrying: false,
        retryMessage: null,
      });
      return;
    }

    touch(status, {
      stage: 'completed',
      articleCount: result.articleCount,
      generated: result.generated,
      skipped: result.skipped,
      failed: result.failed,
      failedUrls: result.failedUrls,
      currentArticleTitle: null,
      currentArticleUrl: null,
      currentArticleIndex: 0,
      currentArticleTotal: 0,
      retrying: false,
      retryMessage: null,
    });
  });

  return status;
}

export function getManualSyncJobStatus(jobId?: string): ManualSyncJobStatus | null {
  if (jobId) {
    return jobs.get(jobId) || null;
  }

  return Array.from(jobs.values())
    .filter(status => !isTerminalStage(status.stage))
    .sort((left, right) => right.updatedAt - left.updatedAt)[0] || null;
}

export function listManualSyncJobStatuses(jobIds?: string[]): ManualSyncJobStatus[] {
  const candidates = jobIds && jobIds.length > 0
    ? jobIds.map(jobId => jobs.get(jobId)).filter((status): status is ManualSyncJobStatus => Boolean(status))
    : Array.from(jobs.values()).filter(status => !isTerminalStage(status.stage));

  return candidates.sort((left, right) => right.updatedAt - left.updatedAt);
}

export function cancelManualSyncJob(jobId: string): ManualSyncJobStatus | null {
  const status = jobs.get(jobId) || null;
  if (!status) {
    return null;
  }
  if (isTerminalStage(status.stage)) {
    return status;
  }

  touch(status, {
    cancelRequested: true,
    stage: 'cancelling',
  });
  return status;
}