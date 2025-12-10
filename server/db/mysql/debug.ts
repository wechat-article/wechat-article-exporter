/**
 * MySQL 存储层实现 - Debug 表
 * 调试数据缓存管理
 */

import { query, execute, hashUrl, blobToBuffer, bufferToBlob } from '../../utils/mysql';
import type { DebugAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface DebugRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    type: string;
    title: string;
    file: Buffer;
}

/**
 * 更新Debug缓存
 */
export async function updateDebugCache(debug: DebugAsset): Promise<boolean> {
    const urlHash = hashUrl(debug.url);
    const now = Math.round(Date.now() / 1000);
    const fileBuffer = blobToBuffer(debug.file);

    await execute(
        `INSERT INTO debug (url, url_hash, fakeid, type, title, file, create_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       type = VALUES(type),
       title = VALUES(title),
       file = VALUES(file)`,
        [
            debug.url,
            urlHash,
            debug.fakeid,
            debug.type,
            debug.title,
            fileBuffer,
            now,
        ]
    );
    return true;
}

/**
 * 获取Debug缓存
 * 注意: 返回的 file 是 Base64 字符串，供 REST API 传输使用
 */
export async function getDebugCache(url: string): Promise<{ url: string; fakeid: string; type: string; title: string; file: string } | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<DebugRow[]>(
        'SELECT * FROM debug WHERE url_hash = ?',
        [urlHash]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    // 将 Buffer 转为 Base64 字符串，供 REST API 传输
    const base64File = row.file ? `data:application/octet-stream;base64,${row.file.toString('base64')}` : '';

    return {
        url: row.url,
        fakeid: row.fakeid,
        type: row.type,
        title: row.title,
        file: base64File,
    };
}

/**
 * 获取所有Debug信息
 */
export async function getDebugInfo(): Promise<DebugAsset[]> {
    const rows = await query<DebugRow[]>('SELECT * FROM debug');

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        type: row.type,
        title: row.title,
        file: bufferToBlob(row.file),
    }));
}

/**
 * 根据公众号ID获取所有Debug
 */
export async function getDebugByFakeid(fakeid: string): Promise<DebugAsset[]> {
    const rows = await query<DebugRow[]>(
        'SELECT * FROM debug WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        type: row.type,
        title: row.title,
        file: bufferToBlob(row.file),
    }));
}
