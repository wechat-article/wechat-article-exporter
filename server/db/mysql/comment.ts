/**
 * MySQL 存储层实现 - Comment 表
 * 评论缓存管理
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { CommentAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface CommentRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    data: string;
}

/**
 * 更新Comment缓存
 */
export async function updateCommentCache(comment: CommentAsset): Promise<boolean> {
    const urlHash = hashUrl(comment.url);
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO comment (url, url_hash, fakeid, title, data, create_time)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       data = VALUES(data)`,
        [
            comment.url,
            urlHash,
            comment.fakeid,
            comment.title,
            JSON.stringify(comment.data),
            now,
        ]
    );
    return true;
}

/**
 * 获取Comment缓存
 */
export async function getCommentCache(url: string): Promise<CommentAsset | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<CommentRow[]>(
        'SELECT * FROM comment WHERE url_hash = ?',
        [urlHash]
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
 * 根据公众号ID获取所有Comment
 */
export async function getCommentsByFakeid(fakeid: string): Promise<CommentAsset[]> {
    const rows = await query<CommentRow[]>(
        'SELECT * FROM comment WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    }));
}
