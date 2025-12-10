/**
 * MySQL 存储层实现 - HTML 表
 * HTML内容缓存管理
 */

import { query, execute, hashUrl, blobToBuffer, bufferToBlob } from '../../utils/mysql';
import type { HtmlAsset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface HtmlRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    comment_id: string | null;
    file: Buffer;
}

/**
 * 更新HTML缓存
 */
export async function updateHtmlCache(html: HtmlAsset): Promise<boolean> {
    const urlHash = hashUrl(html.url);
    const now = Math.round(Date.now() / 1000);
    const fileBuffer = blobToBuffer(html.file);

    await execute(
        `INSERT INTO html (url, url_hash, fakeid, title, comment_id, file, create_time)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       comment_id = VALUES(comment_id),
       file = VALUES(file)`,
        [
            html.url,
            urlHash,
            html.fakeid,
            html.title,
            html.commentID,
            fileBuffer,
            now,
        ]
    );
    return true;
}

/**
 * 获取HTML缓存
 * 注意: 返回的 file 是 Base64 字符串，供 REST API 传输使用
 */
export async function getHtmlCache(url: string): Promise<{ url: string; fakeid: string; title: string; commentID: string | null; file: string } | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<HtmlRow[]>(
        'SELECT * FROM html WHERE url_hash = ?',
        [urlHash]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    // 将 Buffer 转为 Base64 字符串，供 REST API 传输
    const base64File = row.file ? `data:text/html;base64,${row.file.toString('base64')}` : '';

    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        commentID: row.comment_id,
        file: base64File,
    };
}

/**
 * 根据公众号ID获取所有HTML
 */
export async function getHtmlByFakeid(fakeid: string): Promise<HtmlAsset[]> {
    const rows = await query<HtmlRow[]>(
        'SELECT * FROM html WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        commentID: row.comment_id,
        file: bufferToBlob(row.file, 'text/html'),
    }));
}
