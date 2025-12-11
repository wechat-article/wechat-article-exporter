/**
 * MySQL 存储层实现 - ResourceMap 表
 * (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { ResourceMapData } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface ResourceMapRow extends RowDataPacket {
    owner_id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    resources: string;
    create_time: number;
}

/**
 * 更新资源映射缓存
 */
export async function updateResourceMapCache(ownerId: string, data: ResourceMapData): Promise<void> {
    const urlHash = hashUrl(data.url);
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO resource_map (owner_id, url, url_hash, fakeid, resources, create_time)
         VALUES (?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         fakeid = VALUES(fakeid),
         resources = VALUES(resources)`,
        [ownerId, data.url, urlHash, data.fakeid, JSON.stringify(data.resources), now]
    );
}

/**
 * 获取资源映射缓存
 */
export async function getResourceMapCache(ownerId: string, url: string): Promise<ResourceMapData | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<ResourceMapRow[]>(
        'SELECT * FROM resource_map WHERE owner_id = ? AND url_hash = ?',
        [ownerId, urlHash]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        resources: typeof row.resources === 'string' ? JSON.parse(row.resources) : row.resources,
    };
}

/**
 * 根据公众号ID获取所有资源映射
 */
export async function getResourceMapsByFakeid(ownerId: string, fakeid: string): Promise<ResourceMapData[]> {
    const rows = await query<ResourceMapRow[]>(
        'SELECT * FROM resource_map WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        resources: typeof row.resources === 'string' ? JSON.parse(row.resources) : row.resources,
    }));
}
