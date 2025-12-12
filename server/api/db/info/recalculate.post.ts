/**
 * POST /api/db/info/recalculate
 * 重新计算 info 表的统计数据（从 article 表重新计算 count 和 articles）
 */

import { query, execute } from '~/server/utils/mysql';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';
import type { RowDataPacket } from 'mysql2/promise';

export default defineEventHandler(async (event) => {
    try {
        const ownerId = await getOwnerIdFromRequest(event);
        if (!ownerId) {
            return {
                code: -1,
                data: null,
                message: 'Unauthorized: owner_id not found',
            };
        }

        const body = await readBody(event);
        const fakeid = body?.fakeid;

        if (!fakeid) {
            return {
                code: -1,
                data: null,
                message: 'Missing fakeid in request body',
            };
        }

        // 从 article 表重新计算统计数据
        // count = 消息数 (itemidx = 1 的文章数)
        // articles = 文章数 (总记录数)
        const statsResult = await query<RowDataPacket[]>(
            `SELECT 
                COUNT(*) as articles,
                COUNT(CASE WHEN JSON_EXTRACT(data, '$.itemidx') = 1 THEN 1 END) as count,
                MAX(create_time) as latest_time
             FROM article 
             WHERE owner_id = ? AND fakeid = ?`,
            [ownerId, fakeid]
        );

        const articles = statsResult[0]?.articles || 0;
        const count = statsResult[0]?.count || 0;
        const latestTime = statsResult[0]?.latest_time || null;

        // 更新 info 表
        // 对于已完成账号，total_count 应该等于 count
        const now = Math.round(Date.now() / 1000);
        await execute(
            `UPDATE info SET 
                count = ?,
                articles = ?,
                total_count = CASE WHEN completed = 1 THEN ? ELSE total_count END,
                last_update_time = ?,
                update_time = ?
             WHERE owner_id = ? AND fakeid = ?`,
            [count, articles, count, latestTime, now, ownerId, fakeid]
        );

        return {
            code: 0,
            data: {
                count,
                articles,
                total_count: count,
                latestTime,
            },
            message: 'Stats recalculated successfully',
        };
    } catch (error: any) {
        console.error('Failed to recalculate stats:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to recalculate stats',
        };
    }
});
