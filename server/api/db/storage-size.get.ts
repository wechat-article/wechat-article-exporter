import { query } from '~/server/utils/mysql';
import { getOwnerIdFromRequest } from '~/server/utils/CookieStore';
import type { RowDataPacket } from 'mysql2/promise';

interface TableSizeRow extends RowDataPacket {
    table_name: string;
    row_count: number;
    data_size: number;
}

/**
 * 获取当前 owner_id 下的数据库存储大小
 * 通过计算各表中属于该 owner_id 的数据行数和大小来估算
 */
export default defineEventHandler(async (event) => {
    try {
        const ownerId = await getOwnerIdFromRequest(event);

        if (!ownerId) {
            return {
                success: true,
                data: {
                    totalBytes: 0,
                    tables: [],
                    message: '未登录，无法获取存储大小',
                },
            };
        }

        // 需要统计的表及其大体积字段
        // 估算策略：
        // - html表：content 字段是 LONGBLOB，按实际长度计算
        // - asset/resource表：file 字段是 LONGBLOB，按实际长度计算
        // - 其他表：按平均行大小 * 行数估算

        const tableStats: { name: string; rowCount: number; dataSize: number }[] = [];

        // 1. HTML 表 - 主要存储开销
        const [htmlStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(content)), 0) as data_size
            FROM html WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'html',
            rowCount: htmlStats?.row_count || 0,
            dataSize: htmlStats?.data_size || 0,
        });

        // 2. Asset 表 - 图片等资源
        const [assetStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(file)), 0) as data_size
            FROM asset WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'asset',
            rowCount: assetStats?.row_count || 0,
            dataSize: assetStats?.data_size || 0,
        });

        // 3. Resource 表 - 资源备份
        const [resourceStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(file)), 0) as data_size
            FROM resource WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'resource',
            rowCount: resourceStats?.row_count || 0,
            dataSize: resourceStats?.data_size || 0,
        });

        // 4. Article 表 - 文章元数据 (data 字段是 JSON)
        const [articleStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(data)), 0) as data_size
            FROM article WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'article',
            rowCount: articleStats?.row_count || 0,
            dataSize: articleStats?.data_size || 0,
        });

        // 5. Metadata 表 - 文章元数据 (data 字段是 JSON)
        const [metadataStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(data)), 0) as data_size
            FROM metadata WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'metadata',
            rowCount: metadataStats?.row_count || 0,
            dataSize: metadataStats?.data_size || 0,
        });

        // 6. Comment 表
        const [commentStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(data)), 0) as data_size
            FROM comment WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'comment',
            rowCount: commentStats?.row_count || 0,
            dataSize: commentStats?.data_size || 0,
        });

        // 7. Comment Reply 表
        const [replyStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(data)), 0) as data_size
            FROM comment_reply WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'comment_reply',
            rowCount: replyStats?.row_count || 0,
            dataSize: replyStats?.data_size || 0,
        });

        // 8. Info 表 - 公众号信息（较小）
        const [infoStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COUNT(*) * 500 as data_size
            FROM info WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'info',
            rowCount: infoStats?.row_count || 0,
            dataSize: infoStats?.data_size || 0,
        });

        // 9. Resource Map 表
        const [resourceMapStats] = await query<RowDataPacket[]>(`
            SELECT COUNT(*) as row_count, COALESCE(SUM(LENGTH(data)), 0) as data_size
            FROM resource_map WHERE owner_id = ?
        `, [ownerId]);
        tableStats.push({
            name: 'resource_map',
            rowCount: resourceMapStats?.row_count || 0,
            dataSize: resourceMapStats?.data_size || 0,
        });

        // 计算总大小
        const totalBytes = tableStats.reduce((sum, t) => sum + t.dataSize, 0);

        return {
            success: true,
            data: {
                totalBytes,
                tables: tableStats.filter(t => t.rowCount > 0), // 只返回有数据的表
            },
        };
    } catch (error: any) {
        console.error('[storage-size] Error:', error);
        return {
            success: false,
            error: error.message,
            data: {
                totalBytes: 0,
                tables: [],
            },
        };
    }
});
