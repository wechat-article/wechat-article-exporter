/**
 * MySQL 存储层实现 - Metadata 表
 * 文章元数据管理
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { Metadata } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface MetadataRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    title: string;
    read_num: number;
    old_like_num: number;
    share_num: number;
    like_num: number;
    comment_num: number;
}

/**
 * 更新元数据缓存
 */
export async function updateMetadataCache(metadata: Metadata): Promise<boolean> {
    const urlHash = hashUrl(metadata.url);
    const now = Math.round(Date.now() / 1000);

    await execute(
        `INSERT INTO metadata (url, url_hash, fakeid, title, read_num, old_like_num, share_num, like_num, comment_num, create_time, update_time)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       title = VALUES(title),
       read_num = VALUES(read_num),
       old_like_num = VALUES(old_like_num),
       share_num = VALUES(share_num),
       like_num = VALUES(like_num),
       comment_num = VALUES(comment_num),
       update_time = VALUES(update_time)`,
        [
            metadata.url,
            urlHash,
            metadata.fakeid,
            metadata.title,
            metadata.readNum,
            metadata.oldLikeNum,
            metadata.shareNum,
            metadata.likeNum,
            metadata.commentNum,
            now,
            now,
        ]
    );
    return true;
}

/**
 * 获取元数据缓存
 */
export async function getMetadataCache(url: string): Promise<Metadata | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<MetadataRow[]>(
        'SELECT * FROM metadata WHERE url_hash = ?',
        [urlHash]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        readNum: row.read_num,
        oldLikeNum: row.old_like_num,
        shareNum: row.share_num,
        likeNum: row.like_num,
        commentNum: row.comment_num,
    };
}

/**
 * 根据公众号ID获取所有元数据
 */
export async function getMetadataByFakeid(fakeid: string): Promise<Metadata[]> {
    const rows = await query<MetadataRow[]>(
        'SELECT * FROM metadata WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        title: row.title,
        readNum: row.read_num,
        oldLikeNum: row.old_like_num,
        shareNum: row.share_num,
        likeNum: row.like_num,
        commentNum: row.comment_num,
    }));
}
