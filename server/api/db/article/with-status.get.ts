/**
 * 获取带状态的文章列表（解决 N+1 问题）
 * GET /api/db/article/with-status?fakeid=xxx&createTime=xxx
 */

import { getArticleCacheWithStatus } from '~/server/db/mysql';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';

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

        const query = getQuery(event);
        const fakeid = query.fakeid as string;
        const createTime = parseInt(query.createTime as string) || Date.now();

        if (!fakeid) {
            return {
                code: -1,
                data: null,
                message: 'Missing fakeid parameter',
            };
        }

        const articles = await getArticleCacheWithStatus(ownerId, fakeid, createTime);

        return {
            code: 0,
            data: articles,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to get articles with status:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to get articles with status',
        };
    }
});
