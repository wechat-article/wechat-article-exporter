/**
 * MySQL 存储层实现 - Asset 表
 * 资源文件缓存管理
 */

import { query, execute, hashUrl, blobToBuffer, bufferToBlob } from '../../utils/mysql';
import type { Asset } from '../../../store/v3/types';
import type { RowDataPacket } from 'mysql2/promise';

interface AssetRow extends RowDataPacket {
    url: string;
    url_hash: string;
    fakeid: string;
    file: Buffer;
}

/**
 * 更新Asset缓存
 */
export async function updateAssetCache(asset: Asset): Promise<boolean> {
    const urlHash = hashUrl(asset.url);
    const now = Math.round(Date.now() / 1000);
    const fileBuffer = await blobToBuffer(asset.file);

    await execute(
        `INSERT INTO asset (url, url_hash, fakeid, file, create_time)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       file = VALUES(file)`,
        [
            asset.url,
            urlHash,
            asset.fakeid,
            fileBuffer,
            now,
        ]
    );
    return true;
}

/**
 * 获取Asset缓存
 */
export async function getAssetCache(url: string): Promise<Asset | undefined> {
    const urlHash = hashUrl(url);
    const rows = await query<AssetRow[]>(
        'SELECT * FROM asset WHERE url_hash = ?',
        [urlHash]
    );

    if (rows.length === 0) return undefined;

    const row = rows[0];
    return {
        url: row.url,
        fakeid: row.fakeid,
        file: bufferToBlob(row.file),
    };
}

/**
 * 根据公众号ID获取所有Asset
 */
export async function getAssetsByFakeid(fakeid: string): Promise<Asset[]> {
    const rows = await query<AssetRow[]>(
        'SELECT * FROM asset WHERE fakeid = ?',
        [fakeid]
    );

    return rows.map(row => ({
        url: row.url,
        fakeid: row.fakeid,
        file: bufferToBlob(row.file),
    }));
}
