import { db } from './db';

export type ApiName = 'searchbiz' | 'appmsgpublish' | 'switchacc';

interface APICall {
  name: ApiName;
  account: string;
  call_time: number;
  is_normal: boolean;
  payload: Record<string, any>;
}

export type { APICall };

/**
 * 写入调用记录
 * @param record
 */
export async function updateAPICache(record: APICall) {
  return db.transaction('rw', 'api', () => {
    db.api.put(record);
    return true;
  });
}

export async function queryAPICall(
  account: string,
  start: number,
  end: number = new Date().getTime()
): Promise<APICall[]> {
  return db.transaction('r', 'api', () => {
    return db.api
      .where('account')
      .equals(account)
      .and(item => item.call_time > start && item.call_time < end)
      .toArray();
  });
}
