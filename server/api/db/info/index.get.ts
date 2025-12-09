/**
 * GET /api/db/info
 * 获取所有公众号信息
 */

import { getAllInfo } from '~/server/db/mysql';

export default defineEventHandler(async (event) => {
    try {
        const infos = await getAllInfo();
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
