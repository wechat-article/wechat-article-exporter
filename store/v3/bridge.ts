/**
 * 存储层桥接模块
 * 提供统一的存储接口，可在 IndexedDB 和 MySQL 之间切换
 * 
 * 使用方法：
 * 1. 默认使用 MySQL 后端 (通过 REST API)
 * 2. 如需使用 IndexedDB，设置 window.__USE_INDEXEDDB__ = true
 */

import { getStorageAdapter } from './adapter';
import type { StorageAdapter } from './adapter';

// 导出存储适配器实例
export const storage: StorageAdapter = getStorageAdapter();

// ======== 便捷函数导出 (与 v2 API 兼容) ========

// Info 操作
export const getInfoCache = storage.getInfo.bind(storage);
export const getAllInfo = storage.getAllInfo.bind(storage);
export const updateInfoCache = storage.updateInfo.bind(storage);
export const updateLastUpdateTime = storage.updateLastUpdateTime.bind(storage);
export const importInfos = storage.importInfos.bind(storage);

// Article 操作
export const updateArticleCache = storage.updateArticleCache.bind(storage);
export const hitCache = storage.hitCache.bind(storage);
export const getArticleCache = storage.getArticleCache.bind(storage);
export const getArticleByLink = storage.getArticleByLink.bind(storage);
export const articleDeleted = storage.articleDeleted.bind(storage);

// Metadata 操作
export const updateMetadataCache = storage.updateMetadataCache.bind(storage);
export const getMetadataCache = storage.getMetadataCache.bind(storage);

// HTML 操作
export const updateHtmlCache = storage.updateHtmlCache.bind(storage);
export const getHtmlCache = storage.getHtmlCache.bind(storage);

// Asset 操作
export const updateAssetCache = storage.updateAssetCache.bind(storage);
export const getAssetCache = storage.getAssetCache.bind(storage);

// Resource 操作
export const updateResourceCache = storage.updateResourceCache.bind(storage);
export const getResourceCache = storage.getResourceCache.bind(storage);

// ResourceMap 操作
export const updateResourceMapCache = storage.updateResourceMapCache.bind(storage);
export const getResourceMapCache = storage.getResourceMapCache.bind(storage);

// Comment 操作
export const updateCommentCache = storage.updateCommentCache.bind(storage);
export const getCommentCache = storage.getCommentCache.bind(storage);

// CommentReply 操作
export const updateCommentReplyCache = storage.updateCommentReplyCache.bind(storage);
export const getCommentReplyCache = storage.getCommentReplyCache.bind(storage);

// Debug 操作
export const updateDebugCache = storage.updateDebugCache.bind(storage);
export const getDebugCache = storage.getDebugCache.bind(storage);
export const getDebugInfo = storage.getDebugInfo.bind(storage);

// API Call 操作
export const updateAPICache = storage.updateAPICache.bind(storage);
export const queryAPICall = storage.queryAPICall.bind(storage);

// 批量删除
export const deleteAccountData = storage.deleteAccountData.bind(storage);

// 类型重新导出
export type {
    Info,
    ArticleAsset,
    Metadata,
    HtmlAsset,
    Asset,
    ResourceAsset,
    ResourceMapAsset,
    CommentAsset,
    CommentReplyAsset,
    DebugAsset,
    APICall,
    ApiName,
    StorageAdapter
} from './types';
