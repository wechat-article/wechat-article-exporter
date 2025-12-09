/**
 * MySQL 存储层 - 统一入口
 * 导出所有存储操作函数
 */

// Info 操作
export {
    getInfo,
    getAllInfo,
    updateInfo,
    updateLastUpdateTime,
    importInfos,
    getAccountNameByFakeid,
} from './info';

// Article 操作
export {
    updateArticleCache,
    hitCache,
    getArticleCache,
    getArticleByLink,
    articleDeleted,
    getArticlesByFakeid,
    getArticle,
} from './article';

// Metadata 操作
export {
    updateMetadataCache,
    getMetadataCache,
    getMetadataByFakeid,
} from './metadata';

// HTML 操作
export {
    updateHtmlCache,
    getHtmlCache,
    getHtmlByFakeid,
} from './html';

// Asset 操作
export {
    updateAssetCache,
    getAssetCache,
    getAssetsByFakeid,
} from './asset';

// Resource 操作
export {
    updateResourceCache,
    getResourceCache,
    getResourcesByFakeid,
} from './resource';

// ResourceMap 操作
export {
    updateResourceMapCache,
    getResourceMapCache,
    getResourceMapsByFakeid,
} from './resource-map';

// Comment 操作
export {
    updateCommentCache,
    getCommentCache,
    getCommentsByFakeid,
} from './comment';

// CommentReply 操作
export {
    updateCommentReplyCache,
    getCommentReplyCache,
    getCommentRepliesByFakeid,
} from './comment-reply';

// Debug 操作
export {
    updateDebugCache,
    getDebugCache,
    getDebugInfo,
    getDebugByFakeid,
} from './debug';

// API Call 操作
export {
    updateAPICache,
    queryAPICall,
    getAllAPICalls,
    clearAPICallsByAccount,
} from './api';

// 类型导出
export type * from '../../../store/v3/types';

// 工具函数
export { hashUrl, testConnection, closePool } from '../../utils/mysql';
