/**
 * MySQL 存储层实现 - CommentReply 表
 * (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { CommentReplyData } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface CommentReplyRow extends RowDataPacket {
    owner_id: string;
    id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    content_id: string;
    data: string;
    create_time: number;
}

/**
 * 更新评论回复缓存
 */
export async function updateCommentReplyCache(ownerId: string, data: CommentReplyData): Promise<void> {
    const urlHash = hashUrl(data.url);
    const id = `${urlHash}:${data.content_id}`;
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO comment_reply (owner_id, id, url, url_hash, fakeid, title, content_id, data, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         fakeid = VALUES(fakeid),
         title = VALUES(title),
         data = VALUES(data)`,
        [ownerId, id, data.url, urlHash, data.fakeid, data.title, data.content_id, JSON.stringify(data.data), now]
    );
}

/**
 * 获取评论回复缓存
 */
export async function getCommentReplyCache(ownerId: string, url: string, contentId: string): Promise<CommentReplyData | undefined> {
    const urlHash = hashUrl(url);
    const id = `${urlHash}:${contentId}`;
    const rows = await query<CommentReplyRow[]>(
        'SELECT * FROM comment_reply WHERE owner_id = ? AND id = ?',
        [ownerId, id]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        content_id: row.content_id,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    };
}

/**
 * 根据公众号ID获取所有评论回复
 */
export async function getCommentRepliesByFakeid(ownerId: string, fakeid: string): Promise<CommentReplyData[]> {
    const rows = await query<CommentReplyRow[]>(
        'SELECT * FROM comment_reply WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        content_id: row.content_id,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    }));
}
