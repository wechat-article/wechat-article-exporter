/**
 * MySQL 存储层实现 - CommentReply 表
 * 评论回复缓存管理
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { CommentReplyAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface CommentReplyRow extends RowDataPacket {
    id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    content_id: string;
    data: string;
}

/**
 * 更新CommentReply缓存
 */
export async function updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean> {
    const urlHash = hashUrl(reply.url);
    const id = `${urlHash}:${reply.contentID}`;
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO comment_reply (id, url, url_hash, fakeid, title, content_id, data, create_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       data = VALUES(data)`,
        [
            id,
            reply.url,
            urlHash,
            reply.fakeid,
            reply.title,
            reply.contentID,
            JSON.stringify(reply.data),
            now,
        ]
    );
    return true;
}

/**
 * 获取CommentReply缓存
 */
export async function getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
    const urlHash = hashUrl(url);
    const id = `${urlHash}:${contentID}`;
    const rows = await query<CommentReplyRow[]>(
        'SELECT * FROM comment_reply WHERE id = ?',
        [id]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        contentID: row.content_id,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    };
}

/**
 * 根据公众号ID获取所有CommentReply
 */
export async function getCommentRepliesByFakeid(fakeid: string): Promise<CommentReplyAsset[]> {
    const rows = await query<CommentReplyRow[]>(
        'SELECT * FROM comment_reply WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        contentID: row.content_id,
        data: typeof row.data === 'string' ? JSON.parse(row.data) : row.data,
    }));
}
