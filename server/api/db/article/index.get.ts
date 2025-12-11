/**
 * GET /api/db/article
 * 获取文章列表 (支持按fakeid过滤)
 */

import { getArticlesByFakeid, getArticleCache } from '~/server/db/mysql';
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
        const createTime = parseInt(query.createTime as string) || Date.now() / 1000;

        if (!fakeid) {
            return {
                code: -1,
                data: null,
                message: 'Missing fakeid query parameter',
            };
        }

        const articles = await getArticleCache(ownerId, fakeid, createTime);

        return {
            code: 0,
            data: articles,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to get articles:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to get articles',
        };
    }
});
