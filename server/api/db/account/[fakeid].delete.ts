/**
 * DELETE /api/db/account/:fakeid
 * 删除公众号及其所有相关数据
 */

import { execute, hashUrl } from '~/server/utils/mysql';

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

        const fakeids = fakeid.split(',');

        // 删除所有相关表的数据
        const tables = [
            'article',
            'metadata',
            'html',
            'asset',
            'resource',
            'resource_map',
            'comment',
            'comment_reply',
            'debug',
            'info',
        ];

        for (const table of tables) {
            if (table === 'info') {
                await execute(
                    `DELETE FROM info WHERE fakeid IN (${fakeids.map(() => '?').join(',')})`,
                    fakeids
                );
            } else {
                await execute(
                    `DELETE FROM ${table} WHERE fakeid IN (${fakeids.map(() => '?').join(',')})`,
                    fakeids
                );
            }
        }

        // 清除API调用记录
        await execute('DELETE FROM api_call WHERE 1=1');

        return {
            code: 0,
            data: { deleted: fakeids },
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to delete account data:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to delete account data',
        };
    }
});
