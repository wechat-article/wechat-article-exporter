/**
 * 存储适配器
 * 提供统一的存储接口，支持在 IndexedDB 和 MySQL 之间切换
 */

import type {
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
    StorageAdapter
} from './types';
import type { PublishPage, AppMsgExWithFakeID } from '~/types/types';

// ======== MySQL 适配器 (通过 REST API 访问后端) ========
class MySQLAdapter implements StorageAdapter {
    private baseUrl = '/api/db';

    private async fetch<T>(url: string, options?: RequestInit): Promise<T> {
        const response = await $fetch<{ code: number; data: T; message: string }>(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options?.headers,
            },
        });

        if (response.code !== 0) {
            throw new Error(response.message);
        }

        return response.data;
    }

    // Info 操作
    async getInfo(fakeid: string): Promise<Info | undefined> {
        try {
            return await this.fetch<Info>(`${this.baseUrl}/info/${fakeid}`);
        } catch {
            return undefined;
        }
    }

    async updateInfo(info: Info): Promise<boolean> {
        await this.fetch(`${this.baseUrl}/info/${info.fakeid}`, {
            method: 'PUT',
            body: JSON.stringify(info),
        });
        return true;
    }

    async getAllInfo(): Promise<Info[]> {
        return await this.fetch<Info[]>(`${this.baseUrl}/info`);
    }

    async updateLastUpdateTime(fakeid: string): Promise<boolean> {
        await this.fetch(`${this.baseUrl}/info/${fakeid}`, {
            method: 'PUT',
            body: JSON.stringify({ last_update_time: Math.round(Date.now() / 1000) }),
        });
        return true;
    }

    async importInfos(infos: Info[]): Promise<void> {
        await this.fetch(`${this.baseUrl}/info`, {
            method: 'POST',
            body: JSON.stringify({ infos }),
        });
    }

    // Article 操作
    async updateArticleCache(account: Info, publishPage: PublishPage): Promise<void> {
        await this.fetch(`${this.baseUrl}/article`, {
            method: 'POST',
            body: JSON.stringify({ account, publishPage }),
        });
    }

    async hitCache(fakeid: string, createTime: number): Promise<boolean> {
        const result = await this.fetch<{ hit: boolean }>(
            `${this.baseUrl}/article/hit-cache?fakeid=${fakeid}&createTime=${createTime}`
        );
        return result.hit;
    }

    async getArticleCache(fakeid: string, createTime: number): Promise<AppMsgExWithFakeID[]> {
        return await this.fetch<AppMsgExWithFakeID[]>(
            `${this.baseUrl}/article?fakeid=${fakeid}&createTime=${createTime}`
        );
    }

    async getArticleByLink(url: string): Promise<AppMsgExWithFakeID> {
        return await this.fetch<AppMsgExWithFakeID>(
            `${this.baseUrl}/article/${encodeURIComponent(url)}?byLink=true`
        );
    }

    async articleDeleted(url: string): Promise<void> {
        await this.fetch(`${this.baseUrl}/article/${encodeURIComponent(url)}`, {
            method: 'DELETE',
        });
    }

    // 通用数据操作方法
    private async dataOp<T>(table: string, action: 'get' | 'set', data?: any, key?: string, contentID?: string): Promise<T | undefined> {
        const result = await this.fetch<T>(`${this.baseUrl}/data`, {
            method: 'POST',
            body: JSON.stringify({ table, action, data, key, contentID }),
        });
        return result;
    }

    // Metadata 操作
    async updateMetadataCache(metadata: Metadata): Promise<boolean> {
        await this.dataOp('metadata', 'set', metadata);
        return true;
    }

    async getMetadataCache(url: string): Promise<Metadata | undefined> {
        return await this.dataOp<Metadata>('metadata', 'get', undefined, url);
    }

    // HTML 操作
    async updateHtmlCache(html: HtmlAsset): Promise<boolean> {
        // 注意：Blob 数据需要特殊处理
        const htmlData = {
            ...html,
            file: await this.blobToBase64(html.file),
        };
        await this.dataOp('html', 'set', htmlData);
        return true;
    }

    async getHtmlCache(url: string): Promise<HtmlAsset | undefined> {
        const result = await this.dataOp<any>('html', 'get', undefined, url);
        if (!result) return undefined;
        return {
            ...result,
            file: this.base64ToBlob(result.file, 'text/html'),
        };
    }

    // Asset 操作
    async updateAssetCache(asset: Asset): Promise<boolean> {
        const assetData = {
            ...asset,
            file: await this.blobToBase64(asset.file),
        };
        await this.dataOp('asset', 'set', assetData);
        return true;
    }

    async getAssetCache(url: string): Promise<Asset | undefined> {
        const result = await this.dataOp<any>('asset', 'get', undefined, url);
        if (!result) return undefined;
        return {
            ...result,
            file: this.base64ToBlob(result.file),
        };
    }

    // Resource 操作
    async updateResourceCache(resource: ResourceAsset): Promise<boolean> {
        const resourceData = {
            ...resource,
            file: await this.blobToBase64(resource.file),
        };
        await this.dataOp('resource', 'set', resourceData);
        return true;
    }

    async getResourceCache(url: string): Promise<ResourceAsset | undefined> {
        const result = await this.dataOp<any>('resource', 'get', undefined, url);
        if (!result) return undefined;
        return {
            ...result,
            file: this.base64ToBlob(result.file),
        };
    }

    // ResourceMap 操作
    async updateResourceMapCache(resourceMap: ResourceMapAsset): Promise<boolean> {
        await this.dataOp('resource_map', 'set', resourceMap);
        return true;
    }

    async getResourceMapCache(url: string): Promise<ResourceMapAsset | undefined> {
        return await this.dataOp<ResourceMapAsset>('resource_map', 'get', undefined, url);
    }

    // Comment 操作
    async updateCommentCache(comment: CommentAsset): Promise<boolean> {
        await this.dataOp('comment', 'set', comment);
        return true;
    }

    async getCommentCache(url: string): Promise<CommentAsset | undefined> {
        return await this.dataOp<CommentAsset>('comment', 'get', undefined, url);
    }

    // CommentReply 操作
    async updateCommentReplyCache(reply: CommentReplyAsset): Promise<boolean> {
        await this.dataOp('comment_reply', 'set', reply);
        return true;
    }

    async getCommentReplyCache(url: string, contentID: string): Promise<CommentReplyAsset | undefined> {
        return await this.dataOp<CommentReplyAsset>('comment_reply', 'get', undefined, url, contentID);
    }

    // Debug 操作
    async updateDebugCache(debug: DebugAsset): Promise<boolean> {
        const debugData = {
            ...debug,
            file: await this.blobToBase64(debug.file),
        };
        await this.dataOp('debug', 'set', debugData);
        return true;
    }

    async getDebugCache(url: string): Promise<DebugAsset | undefined> {
        const result = await this.dataOp<any>('debug', 'get', undefined, url);
        if (!result) return undefined;
        return {
            ...result,
            file: this.base64ToBlob(result.file),
        };
    }

    async getDebugInfo(): Promise<DebugAsset[]> {
        // 需要单独实现
        return [];
    }

    // API Call 操作
    async updateAPICache(record: APICall): Promise<boolean> {
        await this.dataOp('api', 'set', record);
        return true;
    }

    async queryAPICall(account: string, start: number, end?: number): Promise<APICall[]> {
        return await this.dataOp<APICall[]>('api', 'get', { account, start, end }) || [];
    }

    // 批量删除
    async deleteAccountData(ids: string[]): Promise<void> {
        await this.fetch(`${this.baseUrl}/account/${ids.join(',')}`, {
            method: 'DELETE',
        });
    }

    // 辅助方法：Blob 转 Base64
    private async blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    // 辅助方法：Base64 转 Blob
    private base64ToBlob(base64: string, type: string = 'application/octet-stream'): Blob {
        const byteCharacters = atob(base64.split(',')[1] || base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        return new Blob([byteArray], { type });
    }
}

// ======== 工厂方法 ========
let adapterInstance: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
    if (!adapterInstance) {
        // 默认使用 MySQL 适配器
        adapterInstance = new MySQLAdapter();
    }
    return adapterInstance;
}

// 导出适配器类供测试使用
export { MySQLAdapter };
export type { StorageAdapter };
