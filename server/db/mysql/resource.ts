/**
 * MySQL 存储层实现 - Resource 表
 * 资源文件缓存管理
 */

import { query, execute, hashUrl, blobToBuffer, bufferToBlob } from '../../utils/mysql';
import type { ResourceAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface ResourceRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    file: Buffer;
}

/**
 * 更新Resource缓存
 */
export async function updateResourceCache(resource: ResourceAsset): Promise<boolean> {
    const urlHash = hashUrl(resource.url);
    const now = Math.round(Date.now() / 1000);
    const fileBuffer = blobToBuffer(resource.file);

    await execute(
        `INSERT INTO resource (url, url_hash, fakeid, file, create_time)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       file = VALUES(file)`,
        [
            resource.url,
            urlHash,
            resource.fakeid,
            fileBuffer,
            now,
        ]
    );
    return true;
}

/**
 * 获取Resource缓存
 * 注意: 返回的 file 是 Base64 字符串，供 REST API 传输使用
 */
export async function getResourceCache(url: string): Promise<{ url: string; fakeid: string; file: string } | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<ResourceRow[]>(
        'SELECT * FROM resource WHERE url_hash = ?',
        [urlHash]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    // 将 Buffer 转为 Base64 字符串，供 REST API 传输
    const base64File = row.file ? `data:application/octet-stream;base64,${row.file.toString('base64')}` : '';

    return {
        url: row.url,
        fakeid: row.fakeid,
        file: base64File,
    };
}

/**
 * 根据公众号ID获取所有Resource
 */
export async function getResourcesByFakeid(fakeid: string): Promise<ResourceAsset[]> {
    const rows = await query<ResourceRow[]>(
        'SELECT * FROM resource WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        file: bufferToBlob(row.file),
    }));
}
