/**
 * MySQL 存储层实现 - Resource 表
 * (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { ResourceAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface ResourceRow extends RowDataPacket {
    owner_id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    file: Buffer;
    create_time: number;
}

/**
 * 将 file 数据转换为 Buffer
 * 支持 Buffer、Blob、Base64 字符串三种类型
 */
async function toBuffer(file: Buffer | Blob | string): Promise<Buffer> {
    if (file instanceof Buffer) {
        return file;
    }
    if (typeof file === 'string') {
        // Base64 字符串 (可能带 data:xxx;base64, 前缀)
        const base64Data = file.includes(',') ? file.split(',')[1] : file;
        return Buffer.from(base64Data, 'base64');
    }
    // Blob
    return Buffer.from(await (file as Blob).arrayBuffer());
}

/**
 * 更新资源文件缓存
 */
export async function updateResourceCache(ownerId: string, data: ResourceAsset): Promise<void> {
    const urlHash = hashUrl(data.url);
    const fileBuffer = await toBuffer(data.file as Buffer | Blob | string);
    const now = Math.round(Date.now() / 1000);

    // 将 undefined 转换为 null，避免 MySQL 错误
    const fakeid = data.fakeid ?? null;

    await execute(
        `INSERT INTO resource (owner_id, url, url_hash, fakeid, file, create_time)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         fakeid = VALUES(fakeid),
         file = VALUES(file)`,
        [ownerId, data.url, urlHash, fakeid, fileBuffer, now]
    );
}

/**
 * 获取资源文件缓存
 * 注意：返回的 file 是 Base64 字符串，以便通过 JSON 传输到前端
 */
export async function getResourceCache(ownerId: string, url: string): Promise<(Omit<ResourceAsset, 'file'> & { file: string }) | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<ResourceRow[]>(
        'SELECT * FROM resource WHERE owner_id = ? AND url_hash = ?',
        [ownerId, urlHash]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        file: `data:application/octet-stream;base64,${row.file.toString('base64')}`,
    };
}

/**
 * 根据公众号ID获取所有资源文件
 */
export async function getResourcesByFakeid(ownerId: string, fakeid: string): Promise<(Omit<ResourceAsset, 'file'> & { file: string })[]> {
    const rows = await query<ResourceRow[]>(
        'SELECT * FROM resource WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        file: `data:application/octet-stream;base64,${row.file.toString('base64')}`,
    }));
}
