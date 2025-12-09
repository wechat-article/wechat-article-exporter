/**
 * 通用数据 CRUD API
 * POST /api/db/data
 * 
 * 支持所有表的增删改查操作
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
                    result = await getMetadataCache(body.key!);
                } else {
                    result = await updateMetadataCache(body.data);
                }
                break;

            case 'html':
                if (body.action === 'get') {
                    result = await getHtmlCache(body.key!);
                } else {
                    result = await updateHtmlCache(body.data);
                }
                break;

            case 'asset':
                if (body.action === 'get') {
                    result = await getAssetCache(body.key!);
                } else {
                    result = await updateAssetCache(body.data);
                }
                break;

            case 'resource':
                if (body.action === 'get') {
                    result = await getResourceCache(body.key!);
                } else {
                    result = await updateResourceCache(body.data);
                }
                break;

            case 'resource_map':
                if (body.action === 'get') {
                    result = await getResourceMapCache(body.key!);
                } else {
                    result = await updateResourceMapCache(body.data);
                }
                break;

            case 'comment':
                if (body.action === 'get') {
                    result = await getCommentCache(body.key!);
                } else {
                    result = await updateCommentCache(body.data);
                }
                break;

            case 'comment_reply':
                if (body.action === 'get') {
                    result = await getCommentReplyCache(body.key!, body.contentID!);
                } else {
                    result = await updateCommentReplyCache(body.data);
                }
                break;

            case 'debug':
                if (body.action === 'get') {
                    result = await getDebugCache(body.key!);
                } else {
                    result = await updateDebugCache(body.data);
                }
                break;

            case 'api':
                if (body.action === 'get') {
                    result = await queryAPICall(body.data.account, body.data.start, body.data.end);
                } else {
                    result = await updateAPICache(body.data);
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
