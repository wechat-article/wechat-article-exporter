/**
 * POST /api/db/html/batch-get
 * 批量获取多个 URL 的 HTML 内容
 * 
 * Request body: { urls: string[] }
 * Response: { code: number, data: Record<string, HtmlAsset>, message: string }
 * data 是 URL -> HtmlAsset 的映射对象
 */

import { getHtmlByUrls } from '~/server/db/mysql/html';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';

export default defineEventHandler(async (event) => {
    try {
        const ownerId = await getOwnerIdFromRequest(event);
        if (!ownerId) {
            return {
                code: -1,
                data: {},
                message: 'Unauthorized: owner_id not found',
            };
        }

        const body = await readBody<{ urls: string[] }>(event);
        if (!body.urls || !Array.isArray(body.urls)) {
            return {
                code: -1,
                data: {},
                message: 'Missing urls parameter',
            };
        }

        const htmlMap = await getHtmlByUrls(ownerId, body.urls);

        // 将 Map 转换为普通对象以便 JSON 序列化
        const data: Record<string, any> = {};
        htmlMap.forEach((value, key) => {
            data[key] = value;
        });

        return {
            code: 0,
            data,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Batch get HTML failed:', error);
        return {
            code: -1,
            data: {},
            message: error.message || 'Batch get failed',
        };
    }
});
