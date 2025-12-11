/**
 * MySQL 存储层实现 - Info 表
 * 公众号信息管理 (支持多账号隔离)
 */

import { query, execute, hashUrl } from '../../utils/mysql';
import type { Info } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface InfoRow extends RowDataPacket, Omit<Info, 'completed'> {
    completed: number;
    owner_id: string;
}

/**
 * 获取单个公众号信息（从 article 表实时计算 count 和 articles）
 */
export async function getInfo(ownerId: string, fakeid: string): Promise<Info | undefined> {
    // 使用 LEFT JOIN 从 article 表实时计算 count 和 articles
    const rows = await query<RowDataPacket[]>(
        `SELECT 
            i.owner_id,
            i.fakeid,
            i.completed,
            i.nickname,
            i.round_head_img,
            i.create_time,
            i.update_time,
            i.last_update_time,
            i.total_count,
            COALESCE(stats.article_count, 0) as articles,
            COALESCE(stats.msg_count, 0) as count
         FROM info i
         LEFT JOIN (
            SELECT 
                fakeid,
                COUNT(*) as article_count,
                COUNT(CASE WHEN JSON_EXTRACT(data, '$.itemidx') = 1 THEN 1 END) as msg_count
            FROM article
            WHERE owner_id = ? AND fakeid = ?
            GROUP BY fakeid
         ) stats ON i.fakeid = stats.fakeid
         WHERE i.owner_id = ? AND i.fakeid = ?`,
        [ownerId, fakeid, ownerId, fakeid]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    const count = Number(row.count) || 0;
    const isCompleted = row.completed === 1;
    let totalCount = Number(row.total_count) || 0;

    // 对于已完成账号，如果 total_count 为 0（旧数据问题），使用 count 作为 total_count
    if (isCompleted && totalCount === 0 && count > 0) {
        totalCount = count;
    }

    return {
        fakeid: row.fakeid,
        completed: isCompleted,
        count: count,
        articles: Number(row.articles) || 0,
        total_count: totalCount,
        nickname: row.nickname,
        round_head_img: row.round_head_img,
        create_time: row.create_time,
        update_time: row.update_time,
        last_update_time: row.last_update_time,
    };
}

/**
 * 获取所有公众号信息（从 article 表实时计算 count 和 articles）
 */
export async function getAllInfo(ownerId: string): Promise<Info[]> {
    // 使用 LEFT JOIN 从 article 表实时计算 count 和 articles
    // total_count 保留 info 表的值（来自微信 API）
    const rows = await query<RowDataPacket[]>(
        `SELECT 
            i.owner_id,
            i.fakeid,
            i.completed,
            i.nickname,
            i.round_head_img,
            i.create_time,
            i.update_time,
            i.last_update_time,
            i.total_count,
            COALESCE(stats.article_count, 0) as articles,
            COALESCE(stats.msg_count, 0) as count
         FROM info i
         LEFT JOIN (
            SELECT 
                fakeid,
                COUNT(*) as article_count,
                COUNT(CASE WHEN JSON_EXTRACT(data, '$.itemidx') = 1 THEN 1 END) as msg_count
            FROM article
            WHERE owner_id = ?
            GROUP BY fakeid
         ) stats ON i.fakeid = stats.fakeid
         WHERE i.owner_id = ?
         ORDER BY i.update_time DESC`,
        [ownerId, ownerId]
    );
    return rows.map(row => {
        const count = Number(row.count) || 0;
        const isCompleted = row.completed === 1;
        let totalCount = Number(row.total_count) || 0;

        // 对于已完成账号，如果 total_count 为 0（旧数据问题），使用 count 作为 total_count
        if (isCompleted && totalCount === 0 && count > 0) {
            totalCount = count;
        }

        return {
            fakeid: row.fakeid,
            completed: isCompleted,
            count: count,
            articles: Number(row.articles) || 0,
            total_count: totalCount,
            nickname: row.nickname,
            round_head_img: row.round_head_img,
            create_time: row.create_time,
            update_time: row.update_time,
            last_update_time: row.last_update_time,
        } as Info;
    });
}

/**
 * 更新公众号信息
 */
export async function updateInfo(ownerId: string, info: Info): Promise<boolean> {
    const existing = await getInfo(ownerId, info.fakeid);
    const now = Math.round(Date.now() / 1000);

    if (existing) {
        // 更新现有记录
        await execute(
            `UPDATE info SET 
        completed = IF(? = 1, 1, completed),
        count = count + ?,
        articles = articles + ?,
        nickname = COALESCE(?, nickname),
        round_head_img = COALESCE(?, round_head_img),
        total_count = ?,
        update_time = ?
      WHERE owner_id = ? AND fakeid = ?`,
            [
                info.completed ? 1 : 0,
                info.count,
                info.articles,
                info.nickname || null,
                info.round_head_img || null,
                info.total_count,
                now,
                ownerId,
                info.fakeid,
            ]
        );
    } else {
        // 插入新记录
        await execute(
            `INSERT INTO info (owner_id, fakeid, completed, count, articles, nickname, round_head_img, total_count, create_time, update_time)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                ownerId,
                info.fakeid,
                info.completed ? 1 : 0,
                info.count,
                info.articles,
                info.nickname || null,
                info.round_head_img || null,
                info.total_count,
                now,
                now,
            ]
        );
    }
    return true;
}

/**
 * 更新最后更新时间
 */
export async function updateLastUpdateTime(ownerId: string, fakeid: string): Promise<boolean> {
    const now = Math.round(Date.now() / 1000);
    await execute(
        'UPDATE info SET last_update_time = ? WHERE owner_id = ? AND fakeid = ?',
        [now, ownerId, fakeid]
    );
    return true;
}

/**
 * 批量导入公众号信息
 */
export async function importInfos(ownerId: string, infos: Info[]): Promise<void> {
    for (const info of infos) {
        // 导入时重置相关数量
        const importInfo: Info = {
            fakeid: info.fakeid,
            completed: false,
            count: 0,
            articles: 0,
            nickname: info.nickname,
            round_head_img: info.round_head_img,
            total_count: 0,
        };
        await updateInfo(ownerId, importInfo);
    }
}

/**
 * 获取公众号名称
 */
export async function getAccountNameByFakeid(ownerId: string, fakeid: string): Promise<string | null> {
    const info = await getInfo(ownerId, fakeid);
    return info?.nickname || null;
}
