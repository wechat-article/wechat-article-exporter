import { getPool } from '~/server/db/postgres';
import { enqueueAccountSync } from '~/server/utils/account-sync-queue';
import { getAccountInfoRecord } from '~/server/utils/account-info';

interface NormalizedAccountInput {
  fakeid: string;
  nickname: string;
  alias?: string;
  round_head_img: string;
  service_type: number | null;
  signature?: string;
  type?: string;
  is_semiconductor: number;
}

function success(data: Record<string, any>) {
  return {
    base_resp: {
      ret: 0,
      err_msg: 'ok',
    },
    ...data,
  };
}

function failure(message: string) {
  return {
    base_resp: {
      ret: -1,
      err_msg: message,
    },
  };
}

function extractAccountsFromBody(body: any): any[] {
  if (Array.isArray(body?.mpAccounts)) {
    return body.mpAccounts;
  }
  if (Array.isArray(body?.accounts)) {
    return body.accounts;
  }

  const candidate = body?.account ?? body?.mpAccount ?? body;
  if (candidate && typeof candidate === 'object') {
    return [candidate];
  }

  return [];
}

function normalizeAccountInput(account: any): NormalizedAccountInput {
  const fakeid = typeof account?.fakeid === 'string' ? account.fakeid.trim() : '';
  const nickname = typeof account?.nickname === 'string' ? account.nickname.trim() : '';
  const alias = typeof account?.alias === 'string' ? account.alias.trim() : undefined;
  const roundHeadImg = typeof account?.round_head_img === 'string' ? account.round_head_img.trim() : '';
  const serviceType = Number.isFinite(Number(account?.service_type)) ? Number(account.service_type) : null;
  const signature = typeof account?.signature === 'string' ? account.signature.trim() : undefined;
  const type = typeof account?.type === 'string' ? account.type.trim() : undefined;
  const isSemiconductor = Number(account?.is_semiconductor) === 1 ? 1 : 0;

  return {
    fakeid,
    nickname: nickname || fakeid,
    alias,
    round_head_img: roundHeadImg,
    service_type: serviceType,
    signature,
    type,
    is_semiconductor: isSemiconductor,
  };
}

export default defineEventHandler(async event => {
  try {
    const body = await readBody(event);
    const accounts = extractAccountsFromBody(body).map(normalizeAccountInput);

    if (!accounts.length) {
      return failure('请求体不能为空');
    }

    if (accounts.some(account => !account.fakeid)) {
      return failure('fakeid不能为空');
    }

    const pool = getPool();
    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      for (const account of accounts) {
        const now = Math.round(Date.now() / 1000);
        await client.query(
          `INSERT INTO info (
             fakeid,
             completed,
             count,
             articles,
             nickname,
             round_head_img,
             service_type,
             is_semiconductor,
             total_count,
             is_interface,
             status,
             is_delete,
             create_time,
             update_time
           )
           VALUES ($1, FALSE, 0, 0, $2, $3, $4, $5, 0, TRUE, 'queued', FALSE, $6, $6)
           ON CONFLICT (fakeid) DO UPDATE SET
             nickname = COALESCE(NULLIF(EXCLUDED.nickname, ''), info.nickname),
             round_head_img = COALESCE(NULLIF(EXCLUDED.round_head_img, ''), info.round_head_img),
             service_type = COALESCE(EXCLUDED.service_type, info.service_type),
             is_semiconductor = COALESCE(EXCLUDED.is_semiconductor, info.is_semiconductor, 0),
             is_interface = TRUE,
             status = CASE WHEN COALESCE(info.is_delete, FALSE) = TRUE THEN info.status ELSE 'queued' END,
             update_time = EXCLUDED.update_time`,
          [
            account.fakeid,
            account.nickname,
            account.round_head_img,
            account.service_type,
            account.is_semiconductor,
            now,
          ]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    const savedAccounts = await Promise.all(accounts.map(async account => {
      return await getAccountInfoRecord(account.fakeid, { includeDisabled: true });
    }));
    const queuedFakeids: string[] = [];

    for (const account of savedAccounts) {
      if (!account || account.isDelete) {
        continue;
      }

      await enqueueAccountSync({
        source: 'interface',
        fakeid: account.fakeid,
        nickname: account.nickname,
        roundHeadImg: account.roundHeadImg,
        syncToTimestamp: 0,
        exportDocs: false,
      });
      queuedFakeids.push(account.fakeid);
    }

    return success({
      account: savedAccounts[0],
      accounts: savedAccounts.filter(Boolean),
      queued_fakeids: queuedFakeids,
    });
  } catch (error: any) {
    return failure(error?.message || '添加公众号失败');
  }
});