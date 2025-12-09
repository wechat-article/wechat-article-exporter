/**
 * MySQL 存储层实现 - API调用记录表
 * API调用记录管理
 */

import { query, execute } from '../../utils/mysql';
import type { APICall, ApiName } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface APICallRow extends RowDataPacket {
    id: number;
    name: ApiName;
    account: string;
    call_time: number;
    is_normal: number;
    payload: string;
}

/**
 * 写入API调用记录
 */
export async function updateAPICache(record: APICall): Promise<boolean> {
    await execute(
        `INSERT INTO api_call (name, account, call_time, is_normal, payload)
     VALUES (?, ?, ?, ?, ?)`,
        [
            record.name,
            record.account,
            record.call_time,
            record.is_normal ? 1 : 0,
            JSON.stringify(record.payload),
        ]
    );
    return true;
}

/**
 * 查询API调用记录
 */
export async function queryAPICall(
    account: string,
    start: number,
    end: number = Date.now()
): Promise<APICall[]> {
    const rows = await query<APICallRow[]>(
        'SELECT * FROM api_call WHERE account = ? AND call_time > ? AND call_time < ? ORDER BY call_time DESC',
        [account, start, end]
    );

    return rows.map(row => ({
        name: row.name,
        account: row.account,
        call_time: row.call_time,
        is_normal: row.is_normal === 1,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
}

/**
 * 获取所有API调用记录
 */
export async function getAllAPICalls(): Promise<APICall[]> {
    const rows = await query<APICallRow[]>(
        'SELECT * FROM api_call ORDER BY call_time DESC LIMIT 1000'
    );

    return rows.map(row => ({
        name: row.name,
        account: row.account,
        call_time: row.call_time,
        is_normal: row.is_normal === 1,
        payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    }));
}

/**
 * 清除指定账号的API调用记录
 */
export async function clearAPICallsByAccount(account: string): Promise<void> {
    await execute('DELETE FROM api_call WHERE account = ?', [account]);
}
