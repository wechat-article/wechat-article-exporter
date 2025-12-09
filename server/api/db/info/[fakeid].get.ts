/**
 * GET /api/db/info/:fakeid
 * 获取单个公众号信息
 */

import { getInfo } from '~/server/db/mysql';

export default defineEventHandler(async (event) => {
    try {
        const fakeid = getRouterParam(event, 'fakeid');

        if (!fakeid) {
            return {
                code: -1,
                data: null,
                message: 'Missing fakeid parameter',
            };
        }

        const info = await getInfo(fakeid);

        if (!info) {
            return {
                code: -1,
                data: null,
                message: `Info not found for fakeid: ${fakeid}`,
            };
        }

        return {
            code: 0,
            data: info,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to get info:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to get info',
        };
    }
});
