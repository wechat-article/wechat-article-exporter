/**
 * MySQL 存储层实现 - API Call 表
 * (支持多账号隔离)
 */

import { query, execute } from '../../utils/mysql';
import type { APICallData } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface APICallRow extends RowDataPacket {
    id: number;
    owner_id: string;
    name: string;
    account: string;
    call_time: number;
    is_normal: number;
    payload: string;
}

/**
 * 更新 API 调用记录
 */
export async function updateAPICache(ownerId: string, data: APICallData): Promise<void> {
    await execute(
        `INSERT INTO api_call (owner_id, name, account, call_time, is_normal, payload)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [ownerId, data.name, data.account, data.call_time, data.is_normal ? 1 : 0, JSON.stringify(data.payload)]
    );
}

/**
 * 查询 API 调用记录
 */
export async function queryAPICall(ownerId: string, name: string, account: string): Promise<APICallData[]> {
    const rows = await query<APICallRow[]>(
        'SELECT * FROM api_call WHERE owner_id = ? AND name = ? AND account = ? ORDER BY call_time DESC',
        [ownerId, name, account]
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
 * 获取所有 API 调用记录
 */
export async function getAllAPICalls(ownerId: string): Promise<APICallData[]> {
    const rows = await query<APICallRow[]>(
        'SELECT * FROM api_call WHERE owner_id = ? ORDER BY call_time DESC',
        [ownerId]
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
 * 清除指定账号的 API 调用记录
 */
export async function clearAPICallsByAccount(ownerId: string, account: string): Promise<void> {
    await execute(
        'DELETE FROM api_call WHERE owner_id = ? AND account = ?',
        [ownerId, account]
    );
}
