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
 * 获取单个公众号信息
 */
export async function getInfo(ownerId: string, fakeid: string): Promise<Info | undefined> {
    const rows = await query<InfoRow[]>(
        'SELECT * FROM info WHERE owner_id = ? AND fakeid = ?',
        [ownerId, fakeid]
    );
    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        ...row,
        completed: row.completed === 1,
    };
}

/**
 * 获取所有公众号信息
 */
export async function getAllInfo(ownerId: string): Promise<Info[]> {
    const rows = await query<InfoRow[]>(
        'SELECT * FROM info WHERE owner_id = ? ORDER BY update_time DESC',
        [ownerId]
    );
    return rows.map(row => ({
        ...row,
        completed: row.completed === 1,
    }));
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
