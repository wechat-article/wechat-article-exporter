/**
 * POST /api/db/info
 * 批量导入公众号信息
 */

import { importInfos } from '~/server/db/mysql';
import type { Info } from '~/store/v3/types';

export default defineEventHandler(async (event) => {
    try {
        const body = await readBody<{ infos: Info[] }>(event);

        if (!body.infos || !Array.isArray(body.infos)) {
            return {
                code: -1,
                data: null,
                message: 'Invalid request body: infos array required',
            };
        }

        await importInfos(body.infos);

        return {
            code: 0,
            data: { count: body.infos.length },
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to import infos:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to import infos',
        };
    }
});
