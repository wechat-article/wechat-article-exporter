/**
 * 通用数据 CRUD API
 * POST /api/db/data
 * 
 * 支持所有表的增删改查操作 (支持多账号隔离)
 */

import {
    updateMetadataCache, getMetadataCache,
    updateHtmlCache, getHtmlCache,
    updateAssetCache, getAssetCache,
    updateResourceCache, getResourceCache,
    updateResourceMapCache, getResourceMapCache,
    updateCommentCache, getCommentCache,
    updateCommentReplyCache, getCommentReplyCache,
    updateDebugCache, getDebugCache,
    updateAPICache, queryAPICall,
} from '~/server/db/mysql';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';

type TableName = 'metadata' | 'html' | 'asset' | 'resource' | 'resource_map' | 'comment' | 'comment_reply' | 'debug' | 'api';
type ActionType = 'get' | 'set';

interface DataRequest {
    table: TableName;
    action: ActionType;
    data?: any;
    key?: string;
    contentID?: string; // 用于 comment_reply
}

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

        const body = await readBody<DataRequest>(event);

        if (!body.table || !body.action) {
            return {
                code: -1,
                data: null,
                message: 'Missing table or action parameter',
            };
        }

        let result: any = null;

        switch (body.table) {
            case 'metadata':
                if (body.action === 'get') {
                    result = await getMetadataCache(ownerId, body.key!);
                } else {
                    result = await updateMetadataCache(ownerId, body.data);
                }
                break;

            case 'html':
                if (body.action === 'get') {
                    result = await getHtmlCache(ownerId, body.key!);
                } else {
                    result = await updateHtmlCache(ownerId, body.data);
                }
                break;

            case 'asset':
                if (body.action === 'get') {
                    result = await getAssetCache(ownerId, body.key!);
                } else {
                    result = await updateAssetCache(ownerId, body.data);
                }
                break;

            case 'resource':
                if (body.action === 'get') {
                    result = await getResourceCache(ownerId, body.key!);
                } else {
                    result = await updateResourceCache(ownerId, body.data);
                }
                break;

            case 'resource_map':
                if (body.action === 'get') {
                    result = await getResourceMapCache(ownerId, body.key!);
                } else {
                    result = await updateResourceMapCache(ownerId, body.data);
                }
                break;

            case 'comment':
                if (body.action === 'get') {
                    result = await getCommentCache(ownerId, body.key!);
                } else {
                    result = await updateCommentCache(ownerId, body.data);
                }
                break;

            case 'comment_reply':
                if (body.action === 'get') {
                    result = await getCommentReplyCache(ownerId, body.key!, body.contentID!);
                } else {
                    result = await updateCommentReplyCache(ownerId, body.data);
                }
                break;

            case 'debug':
                if (body.action === 'get') {
                    result = await getDebugCache(ownerId, body.key!);
                } else {
                    result = await updateDebugCache(ownerId, body.data);
                }
                break;

            case 'api':
                if (body.action === 'get') {
                    result = await queryAPICall(ownerId, body.data.name, body.data.account);
                } else {
                    result = await updateAPICache(ownerId, body.data);
                }
                break;

            default:
                return {
                    code: -1,
                    data: null,
                    message: `Unknown table: ${body.table}`,
                };
        }

        return {
            code: 0,
            data: result,
            message: 'success',
        };
    } catch (error: any) {
        console.error('Data operation failed:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Data operation failed',
        };
    }
});
