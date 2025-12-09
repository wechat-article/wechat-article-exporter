/**
 * DELETE /api/db/article/:id
 * 标记文章为已删除
 */

import { articleDeleted } from '~/server/db/mysql';

export default defineEventHandler(async (event) => {
    try {
        const id = getRouterParam(event, 'id');

        if (!id) {
            return {
                code: -1,
                data: null,
                message: 'Missing id parameter',
            };
        }

        await articleDeleted(decodeURIComponent(id));

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
