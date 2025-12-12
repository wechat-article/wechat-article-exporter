/**
 * MySQL 存储层实现 - Comment 表
 * (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { CommentData } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface CommentRow extends RowDataPacket {
    owner_id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    data: string;
    create_time: number;
}

/**
 * 更新评论缓存
 */
export async function updateCommentCache(ownerId: string, data: CommentData): Promise<void> {
    const urlHash = hashUrl(data.url);
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO comment (owner_id, url, url_hash, fakeid, title, data, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         fakeid = VALUES(fakeid),
         title = VALUES(title),
         data = VALUES(data)`,
        [ownerId, data.url, urlHash, data.fakeid, data.title, JSON.stringify(data.data), now]
    );
}

/**
 * 获取评论缓存
 */
export async function getCommentCache(ownerId: string, url: string): Promise<CommentData | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<CommentRow[]>(
        'SELECT * FROM comment WHERE owner_id = ? AND url_hash = ?',
        [ownerId, urlHash]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    };
}

/**
 * 根据公众号ID获取所有评论
 */
export async function getCommentsByFakeid(ownerId: string, fakeid: string): Promise<CommentData[]> {
    const rows = await query<CommentRow[]>(
        'SELECT * FROM comment WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    }));
}
