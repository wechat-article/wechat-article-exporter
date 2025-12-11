/**
 * MySQL 存储层实现 - HTML 表
 * (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { HtmlAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface HtmlRow extends RowDataPacket {
    owner_id: string;
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    comment_id: string;
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
 * 更新 HTML 缓存
 */
export async function updateHtmlCache(ownerId: string, data: HtmlAsset & { commentID?: string | null }): Promise<void> {
    const urlHash = hashUrl(data.url);
    const fileBuffer = await toBuffer(data.file as Buffer | Blob | string);
    const now = Math.round(Date.now() / 1000);

    // 兼容前端可能发送的两种字段名（驼峰 commentID 或下划线 comment_id）
    // 将 undefined 转换为 null，避免 MySQL 错误
    const commentId = (data as any).comment_id ?? data.commentID ?? null;
    const fakeid = data.fakeid ?? null;
    const title = data.title ?? null;

    await execute(
        `INSERT INTO html (owner_id, url, url_hash, fakeid, title, comment_id, file, create_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
         fakeid = VALUES(fakeid),
         title = VALUES(title),
         comment_id = VALUES(comment_id),
         file = VALUES(file)`,
        [ownerId, data.url, urlHash, fakeid, title, commentId, fileBuffer, now]
    );
}

/**
 * 获取 HTML 缓存
 * 注意：返回的 file 是 Base64 字符串，以便通过 JSON 传输到前端
 */
export async function getHtmlCache(ownerId: string, url: string): Promise<(Omit<HtmlAsset, 'file'> & { file: string }) | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<HtmlRow[]>(
        'SELECT * FROM html WHERE owner_id = ? AND url_hash = ?',
        [ownerId, urlHash]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        commentID: row.comment_id,
        file: `data:text/html;base64,${row.file.toString('base64')}`,
    };
}

/**
 * 根据公众号ID获取所有 HTML
 * 注意：返回的 file 是 Base64 字符串，以便通过 JSON 传输到前端
 */
export async function getHtmlByFakeid(ownerId: string, fakeid: string): Promise<(Omit<HtmlAsset, 'file'> & { file: string })[]> {
    const rows = await query<HtmlRow[]>(
        'SELECT * FROM html WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        commentID: row.comment_id,
        file: `data:text/html;base64,${row.file.toString('base64')}`,
    }));
}
