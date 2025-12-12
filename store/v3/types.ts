/**
 * MySQL 存储层类型定义
 * 与 IndexedDB (Dexie) 数据结构兼容
 */

import type { AppMsgExWithFakeID, PublishPage } from '~/types/types';
import type { ArticleMetadata } from '~/utils/download/types.d';

// ======== Info 表 ========
export interface Info {
    fakeid: string;
    completed: boolean;
    count: number;
    articles: number;
    nickname?: string;
    round_head_img?: string;
    total_count: number;
    create_time?: number;
    update_time?: number;
    last_update_time?: number;
}

// ======== Article 表 ========
export type ArticleAsset = AppMsgExWithFakeID;

// ======== Metadata 表 ========
export interface Metadata {
    url: string;
    fakeid: string;
    title: string;
    readNum: number;
    oldLikeNum: number;
    shareNum: number;
    likeNum: number;
    commentNum: number;
}

// ======== HTML 表 ========
export interface HtmlAsset {
    fakeid: string;
    url: string;
    file: Blob;
    title: string;
    commentID: string | null;
}

// ======== Asset 表 ========
export interface Asset {
    url: string;
    file: Blob;
    fakeid: string;
}

// ======== Resource 表 ========
export interface ResourceAsset {
    fakeid: string;
    url: string;
    file: Blob;
}

// ======== ResourceMap 表 ========
export interface ResourceMapAsset {
    fakeid: string;
    url: string;
    resources: string[];
}

// ======== Comment 表 ========
export interface CommentAsset {
    fakeid: string;
    url: string;
    title: string;
    data: any;
}

// ======== CommentReply 表 ========
export interface CommentReplyAsset {
    fakeid: string;
    url: string;
    title: string;
    data: any;
    contentID: string;
}

// ======== Debug 表 ========
export interface DebugAsset {
    type: string;
    url: string;
    file: Blob;
    title: string;
    fakeid: string;
}

// ======== API 调用记录表 ========
export type ApiName = 'searchbiz' | 'appmsgpublish';

export interface APICall {
    name: ApiName;
    account: string;
    call_time: number;
    is_normal: boolean;
    payload: Record<string, any>;
}

// ======== 存储适配器接口 ========
export interface StorageAdapter {
    // Info 操作
    getInfo(fakeid: string): Promise<Info | undefined>;
    updateInfo(info: Info): Promise<boolean>;
    getAllInfo(): Promise<Info[]>;
    updateLastUpdateTime(fakeid: string): Promise<boolean>;
    importInfos(infos: Info[]): Promise<void>;

    // Article 操作
    updateArticleCache(account: Info, publishPage: PublishPage): Promise<void>;
    hitCache(fakeid: string, createTime: number): Promise<boolean>;
    getArticleCache(fakeid: string, createTime: number): Promise<ArticleAsset[]>;
    getArticleByLink(url: string): Promise<ArticleAsset>;
    articleDeleted(url: string): Promise<void>;

    // Metadata 操作
    updateMetadataCache(metadata: Metadata): Promise<boolean>;
    getMetadataCache(url: string): Promise<Metadata | undefined>;

    // HTML 操作
    updateHtmlCache(html: HtmlAsset): Promise<boolean>;
    getHtmlCache(url: string): Promise<HtmlAsset | undefined>;

    // Asset 操作
    updateAssetCache(asset: Asset): Promise<boolean>;
    getAssetCache(url: string): Promise<Asset | undefined>;

    // Resource 操作
    updateResourceCache(resource: ResourceAsset): Promise<boolean>;
    getResourceCache(url: string): Promise<ResourceAsset | undefined>;

    // ResourceMap 操作
    updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean>;
    getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined>;

    // Comment 操作
    updateCommentCache(comment: CommentAsset): Promise<boolean>;
    getCommentCache(url: string): Promise<CommentAsset | undefined>;

    // CommentReply 操作
    updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean>;
    getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined>;

    // Debug 操作
    updateDebugCache(debug: DebugAsset): Promise<boolean>;
    getDebugCache(url: string): Promise<DebugAsset | undefined>;
    getDebugInfo(): Promise<DebugAsset[]>;

    // API Call 操作
    updateAPICache(record: APICall): Promise<boolean>;
    queryAPICall(account: string, start: number, end?: number): Promise<APICall[]>;

    // 批量删除
    deleteAccountData(ids: string[]): Promise<void>;
}
