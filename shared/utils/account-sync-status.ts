export const ACCOUNT_SYNC_STATUS = {
  QUEUED: 'queued',
  SYNCING: 'syncing',
  SUCCESS: 'success',
  FAILED: 'failed',
} as const;

export type AccountSyncStatus = (typeof ACCOUNT_SYNC_STATUS)[keyof typeof ACCOUNT_SYNC_STATUS];
export type AccountSyncStatusValue = AccountSyncStatus | null;

export const ACCOUNT_SYNC_STATUS_VALUES = Object.values(ACCOUNT_SYNC_STATUS) as AccountSyncStatus[];

export const ACCOUNT_SYNC_STATUS_LABELS: Record<AccountSyncStatus, string> = {
  [ACCOUNT_SYNC_STATUS.QUEUED]: '排队中',
  [ACCOUNT_SYNC_STATUS.SYNCING]: '同步中',
  [ACCOUNT_SYNC_STATUS.SUCCESS]: '同步成功',
  [ACCOUNT_SYNC_STATUS.FAILED]: '同步失败',
};

export function normalizeAccountSyncStatus(status: unknown): AccountSyncStatusValue {
  if (typeof status === 'string' && ACCOUNT_SYNC_STATUS_VALUES.includes(status as AccountSyncStatus)) {
    return status as AccountSyncStatus;
  }

  return null;
}

export function getAccountSyncStatusLabel(status: unknown): string {
  const normalizedStatus = normalizeAccountSyncStatus(status);
  return normalizedStatus ? ACCOUNT_SYNC_STATUS_LABELS[normalizedStatus] : '';
}