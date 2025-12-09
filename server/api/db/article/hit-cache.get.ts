/**
 * GET /api/db/article/hit-cache
 * 检查是否存在指定时间之前的缓存
 */

import { hitCache } from '~/server/db/mysql';

export default defineEventHandler(async (event) => {
    try {
        const query = getQuery(event);
        const fakeid = query.fakeid as string;
        const createTime = parseInt(query.createTime as string);

        if (!fakeid || !createTime) {
            return {
                code: -1,
                data: null,
                message: 'Missing fakeid or createTime query parameter',
            };
        }

        const hit = await hitCache(fakeid, createTime);

        return {
            code: 0,
            data: { hit },
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to check cache:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to check cache',
        };
    }
});
