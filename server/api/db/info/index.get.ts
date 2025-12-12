/**
 * GET /api/db/info
 * 获取所有公众号信息
 */

import { getAllInfo } from '~/server/db/mysql';
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

        const infos = await getAllInfo(ownerId);
        return {
            code: 0,
            data: infos,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to get all info:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to get info list',
        };
    }
});
