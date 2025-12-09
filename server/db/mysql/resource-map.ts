/**
 * MySQL 存储层实现 - ResourceMap 表
 * 资源映射缓存管理
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { ResourceMapAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface ResourceMapRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    resources: string;
}

/**
 * 更新ResourceMap缓存
 */
export async function updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean> {
    const urlHash = hashUrl(resourceMap.url);
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO resource_map (url, url_hash, fakeid, resources, create_time)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       resources = VALUES(resources)`,
        [
            resourceMap.url,
            urlHash,
            resourceMap.fakeid,
            JSON.stringify(resourceMap.resources),
            now,
        ]
    );
    return true;
}

/**
 * 获取ResourceMap缓存
 */
export async function getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<ResourceMapRow[]>(
        'SELECT * FROM resource_map WHERE url_hash = ?',
        [urlHash]
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
 * 根据公众号ID获取所有ResourceMap
 */
export async function getResourceMapsByFakeid(fakeid: string): Promise<ResourceMapAsset[]> {
    const rows = await query<ResourceMapRow[]>(
        'SELECT * FROM resource_map WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        resources: typeof row.resources === 'string' ? JSON.parse(row.resources) : row.resources,
    }));
}
