import { openDatabase } from './db';

export type ApiName = 'searchbiz' | 'appmsgpublish';

export interface APICall {
  name: ApiName;
  account: string;
  call_time: number;
  is_normal: boolean;
  payload: Record<string, any>;
}

/**
 * 写入调用记录
 * @param record
 */
export async function updateAPICache(record: APICall) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const request = db.transaction('api', 'readwrite').objectStore('api').put(record);
    request.onsuccess = () => {
      resolve(true);
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}

export async function queryAPICall(
  account: string,
  start: number,
  end: number = new Date().getTime()
): Promise<APICall[]> {
  const db = await openDatabase();
  const records: APICall[] = [];

  return new Promise((resolve, reject) => {
    const index = db.transaction('api').objectStore('api').index('account_call_time');

    const range = IDBKeyRange.bound([account, start], [account, end], false, false);
    const request = index.openCursor(range, 'next');

    request.onsuccess = event => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (cursor) {
        records.push(cursor.value);
        cursor.continue();
      } else {
        resolve(records);
      }
    };
    request.onerror = evt => {
      reject(evt);
    };
  });
}
