/**
 * POST /api/db/html/batch-check
 * 批量检查 URL 是否已下载 HTML
 * 
 * Request body: { urls: string[] }
 * Response: { code: number, data: string[], message: string }
 * data 包含已存在的 URL 列表
 */

import { checkHtmlExistsBatch } from '~/server/db/mysql/html';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';

export default defineEventHandler(async (event) => {
    try {
        const ownerId = await getOwnerIdFromRequest(event);
        if (!ownerId) {
            return {
                code: -1,
                data: [],
                message: 'Unauthorized: owner_id not found',
            };
        }

        const body = await readBody<{ urls: string[] }>(event);
        if (!body.urls || !Array.isArray(body.urls)) {
            return {
                code: -1,
                data: [],
                message: 'Missing urls parameter',
            };
        }

        const existingUrls = await checkHtmlExistsBatch(ownerId, body.urls);

        return {
            code: 0,
            data: existingUrls,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Batch check HTML failed:', error);
        return {
            code: -1,
            data: [],
            message: error.message || 'Batch check failed',
        };
    }
});
