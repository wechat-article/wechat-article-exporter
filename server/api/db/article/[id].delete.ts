/**
 * DELETE /api/db/article/:id
 * 标记文章为已删除
 */

import { articleDeleted } from '~/server/db/mysql';
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

        if (!id) {
            return {
                code: -1,
                data: null,
                message: 'Missing id parameter',
            };
        }

        await articleDeleted(ownerId, decodeURIComponent(id));

        return {
            code: 0,
            data: null,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to delete article:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to delete article',
        };
    }
});
