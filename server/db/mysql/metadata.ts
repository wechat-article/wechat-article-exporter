/**
 * MySQL 存储层实现 - Metadata 表
 * (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { MetadataAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface MetadataRow extends RowDataPacket {
    owner_id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    read_num: number;
    old_like_num: number;
    share_num: number;
    like_num: number;
    comment_num: number;
    create_time: number;
    update_time: number;
}

/**
 * 更新元数据缓存
 */
export async function updateMetadataCache(ownerId: string, data: MetadataAsset): Promise<void> {
    const urlHash = hashUrl(data.url);
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO metadata (owner_id, url, url_hash, fakeid, title, read_num, old_like_num, share_num, like_num, comment_num, create_time, update_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         fakeid = VALUES(fakeid),
         title = VALUES(title),
         read_num = VALUES(read_num),
         old_like_num = VALUES(old_like_num),
         share_num = VALUES(share_num),
         like_num = VALUES(like_num),
         comment_num = VALUES(comment_num),
         update_time = VALUES(update_time)`,
        [ownerId, data.url, urlHash, data.fakeid, data.title, data.read_num, data.old_like_num, data.share_num, data.like_num, data.comment_num, now, now]
    );
}

/**
 * 获取元数据缓存
 */
export async function getMetadataCache(ownerId: string, url: string): Promise<MetadataAsset | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<MetadataRow[]>(
        'SELECT * FROM metadata WHERE owner_id = ? AND url_hash = ?',
        [ownerId, urlHash]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        read_num: row.read_num,
        old_like_num: row.old_like_num,
        share_num: row.share_num,
        like_num: row.like_num,
        comment_num: row.comment_num,
    };
}

/**
 * 根据公众号ID获取所有元数据
 */
export async function getMetadataByFakeid(ownerId: string, fakeid: string): Promise<MetadataAsset[]> {
    const rows = await query<MetadataRow[]>(
        'SELECT * FROM metadata WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        read_num: row.read_num,
        old_like_num: row.old_like_num,
        share_num: row.share_num,
        like_num: row.like_num,
        comment_num: row.comment_num,
    }));
}
