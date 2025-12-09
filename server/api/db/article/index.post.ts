/**
 * POST /api/db/article
 * 批量更新文章缓存
 */

import { updateArticleCache } from '~/server/db/mysql';
import type { Info } from '~/store/v3/types';
import type { PublishPage } from '~/types/types';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<{ account: Info; publishPage: PublishPage }>(event);

        if (!body.account || !body.publishPage) {
            return {
                code: -1,
                data: null,
                message: 'Invalid request body: account and publishPage required',
            };
        }

        await updateArticleCache(body.account, body.publishPage);

        return {
            code: 0,
            data: null,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to update article cache:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to update article cache',
        };
    }
});
