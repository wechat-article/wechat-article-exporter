/**
 * PUT /api/db/info/:fakeid
 * 更新公众号信息
 */

import { updateInfo } from '~/server/db/mysql';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';
import type { Info } from '~/store/v3/types';

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

        const fakeid = getRouterParam(event, 'fakeid');

        if (!fakeid) {
            return {
                code: -1,
                data: null,
                message: 'Missing fakeid parameter',
            };
        }

        const body = await readBody<Partial<Info>>(event);

        const info: Info = {
            fakeid,
            completed: body.completed ?? false,
            count: body.count ?? 0,
            articles: body.articles ?? 0,
            nickname: body.nickname,
            round_head_img: body.round_head_img,
            total_count: body.total_count ?? 0,
        };

        await updateInfo(ownerId, info);

        return {
            code: 0,
            data: info,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Failed to update info:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Failed to update info',
        };
    }
});
