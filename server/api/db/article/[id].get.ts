/**
 * GET /api/db/article/:id
 * 获取单篇文章
 */

import { getArticle, getArticleByLink } from '~/server/db/mysql';
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

        const id = getRouterParam(event, 'id');
        const query = getQuery(event);
        const byLink = query.byLink === 'true';

        if (!id) {
            return {
                code: -1,
                data: null,
                message: 'Missing id parameter',
            };
        }

        // 支持通过链接查询
        const article = byLink
            ? await getArticleByLink(ownerId, decodeURIComponent(id))
            : await getArticle(ownerId, id);

        if (!article) {
            return {
                code: -1,
                data: null,
                message: `Article not found: ${id}`,
            };
        }

        return {
            code: 0,
            data: article,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to get article:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to get article',
        };
    }
});
