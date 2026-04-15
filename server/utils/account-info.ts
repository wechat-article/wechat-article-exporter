import { getPool } from '~/server/db/postgres';
import {
  normalizeAccountSyncStatus,
  type AccountSyncStatus,
  type AccountSyncStatusValue,
} from '~/shared/utils/account-sync-status';

export interface AccountInfoRecord {
  fakeid: string;
  nickname: string;
  roundHeadImg: string | null;
  serviceType: number | null;
  isSemiconductor: number;
  totalCount: number;
  count: number;
  articles: number;
  completed: boolean;
  createTime: number | null;
  updateTime: number | null;
  lastUpdateTime: number | null;
  isInterface: boolean;
  status: AccountSyncStatusValue;
  isDelete: boolean;
}

function toBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    return normalized === 'true' || normalized === '1' || normalized === 't' || normalized === 'yes';
  }

  return false;
}

function mapAccountRow(row: any): AccountInfoRecord {
  return {
    fakeid: row.fakeid,
    nickname: row.nickname || row.fakeid,
    roundHeadImg: row.round_head_img || null,
    serviceType: row.service_type === null || row.service_type === undefined ? null : Number(row.service_type),
    isSemiconductor: Number(row.is_semiconductor || 0),
    totalCount: Number(row.total_count || 0),
    count: Number(row.count || 0),
    articles: Number(row.articles || 0),
    completed: toBoolean(row.completed),
    createTime: row.create_time === null || row.create_time === undefined ? null : Number(row.create_time),
    updateTime: row.update_time === null || row.update_time === undefined ? null : Number(row.update_time),
    lastUpdateTime: row.last_update_time === null || row.last_update_time === undefined ? null : Number(row.last_update_time),
    isInterface: toBoolean(row.is_interface),
    status: normalizeAccountSyncStatus(row.status),
    isDelete: toBoolean(row.is_delete),
  };
}

export async function getAccountInfoRecord(fakeid: string, options: { includeDisabled?: boolean } = {}): Promise<AccountInfoRecord | null> {
  const pool = getPool();
  const conditions = ['fakeid = $1'];

  if (!options.includeDisabled) {
    conditions.push('COALESCE(is_delete, FALSE) = FALSE');
  }

  const res = await pool.query(
    `SELECT *
     FROM info
     WHERE ${conditions.join(' AND ')}
     LIMIT 1`,
    [fakeid],
  );

  if (res.rows.length === 0) {
    return null;
  }

  return mapAccountRow(res.rows[0]);
}

export async function listSyncableAccounts(options: { excludeInterface?: boolean; onlyInterface?: boolean } = {}): Promise<AccountInfoRecord[]> {
  const pool = getPool();
  const conditions = ['fakeid IS NOT NULL', 'COALESCE(is_delete, FALSE) = FALSE'];

  if (options.onlyInterface) {
    conditions.push('COALESCE(is_interface, FALSE) = TRUE');
  }

  if (options.excludeInterface) {
    conditions.push('COALESCE(is_interface, FALSE) = FALSE');
  }

  const res = await pool.query(
    `SELECT *
     FROM info
     WHERE ${conditions.join(' AND ')}
     ORDER BY create_time ASC NULLS LAST, fakeid ASC`,
  );

  return res.rows.map(mapAccountRow);
}

export async function updateAccountSyncStatus(fakeid: string, status: AccountSyncStatus): Promise<void> {
  const pool = getPool();
  await pool.query(`UPDATE info SET status = $2 WHERE fakeid = $1`, [fakeid, status]);
}

export async function getPublicAccountStatuses(fakeids: string[]): Promise<Array<{ fakeid: string; status: AccountSyncStatusValue }>> {
  if (fakeids.length === 0) {
    return [];
  }

  const pool = getPool();
  const res = await pool.query(
    `SELECT fakeid, status
     FROM info
     WHERE fakeid = ANY($1::text[])
       AND COALESCE(is_delete, FALSE) = FALSE`,
    [fakeids],
  );

  const statusMap = new Map<string, AccountSyncStatusValue>();
  for (const row of res.rows) {
    statusMap.set(row.fakeid, normalizeAccountSyncStatus(row.status));
  }

  return fakeids
    .filter(fakeid => statusMap.has(fakeid))
    .map(fakeid => ({
      fakeid,
      status: statusMap.get(fakeid) ?? null,
    }));
}