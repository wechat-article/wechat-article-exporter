import { getAccountSyncStatusLabel } from '~/shared/utils/account-sync-status';
import { getPublicAccountStatuses } from '~/server/utils/account-info';

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

interface AccountStatusBody {
  fakeid?: string | string[];
  fakeids?: string[];
}

function normalizeFakeids(body: AccountStatusBody): string[] {
  const values = [
    ...(Array.isArray(body.fakeids) ? body.fakeids : []),
    ...(Array.isArray(body.fakeid) ? body.fakeid : body.fakeid ? [body.fakeid] : []),
  ];

  return Array.from(new Set(values.map(value => (typeof value === 'string' ? value.trim() : '')).filter(Boolean)));
}

export default defineEventHandler(async (event) => {
  const body = await readBody<AccountStatusBody>(event);
  const fakeids = normalizeFakeids(body || {});
  if (fakeids.length === 0) {
    return failure('fakeids不能为空');
  }

  try {
    const list = await getPublicAccountStatuses(fakeids);
    return success({
      fakeids,
      list: list.map(item => ({
        fakeid: item.fakeid,
        status_code: item.status,
        status: item.status ? getAccountSyncStatusLabel(item.status) : null,
      })),
    });
  } catch (error: any) {
    return failure(error?.message || '查询同步状态失败');
  }
});