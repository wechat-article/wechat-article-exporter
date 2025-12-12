import mysql, { type Pool, type PoolConnection, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import crypto from 'crypto';

// MySQL 连接池配置
const pool: Pool = mysql.createPool({
    host: process.env.MYSQL_HOST || 'dev.priate.com',
    port: parseInt(process.env.MYSQL_PORT || '23306'),
    user: process.env.MYSQL_USER || 'wechat-docs',
    password: process.env.MYSQL_PASSWORD || 'your_password_here',
    database: process.env.MYSQL_DATABASE || 'wechat-docs',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    // 支持大型 BLOB 数据
    maxAllowedPacket: 64 * 1024 * 1024, // 64MB
});

/**
 * 规范化微信文章 URL
 * 微信文章 URL 包含动态追踪参数，同一篇文章不同时间访问会有不同 URL
 * 只提取稳定参数：__biz, mid, idx, sn 来生成规范化 URL
 */
export function normalizeWechatUrl(url: string): string {
    // 检查是否是微信公众号文章 URL
    if (!url.includes('mp.weixin.qq.com')) {
        return url; // 非微信 URL，保持原样
    }

    try {
        const parsed = new URL(url);
        const biz = parsed.searchParams.get('__biz') || '';
        const mid = parsed.searchParams.get('mid') || '';
        const idx = parsed.searchParams.get('idx') || '1';
        const sn = parsed.searchParams.get('sn') || '';

        // 如果核心参数都存在，生成规范化 URL
        if (biz && mid && sn) {
            return `https://mp.weixin.qq.com/s?__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}`;
        }

        // 如果缺少核心参数，返回原 URL
        return url;
    } catch {
        // URL 解析失败，返回原 URL
        return url;
    }
}

/**
 * 计算 URL 的 MD5 哈希值，用作主键
 * 对微信文章 URL 会先进行规范化处理，确保同一篇文章产生相同哈希
 */
export function hashUrl(url: string): string {
    const normalizedUrl = normalizeWechatUrl(url);
    return crypto.createHash('md5').update(normalizedUrl).digest('hex');
}

/**
 * 获取数据库连接
 */
export async function getConnection(): Promise<PoolConnection> {
    return pool.getConnection();
}

/**
 * 执行查询
 */
export async function query<T extends RowDataPacket[]>(sql: string, params?: any[]): Promise<T> {
    const [rows] = await pool.query<T>(sql, params);
    return rows;
}

/**
 * 执行更新/插入
 */
export async function execute(sql: string, params?: any[]): Promise<ResultSetHeader> {
    const [result] = await pool.execute<ResultSetHeader>(sql, params);
    return result;
}

/**
 * 测试数据库连接
 */
export async function testConnection(): Promise<boolean> {
    try {
        const conn = await pool.getConnection();
        await conn.ping();
        conn.release();
        return true;
    } catch (error) {
        console.error('MySQL connection failed:', error);
        return false;
    }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
    await pool.end();
}

/**
 * Blob 数据或 Base64 字符串转 Buffer (用于存储)
 * 服务端接收的可能是来自前端的 Base64 字符串
 */
export function blobToBuffer(data: Blob | string): Buffer {
    // 如果是 Base64 字符串 (来自前端 REST API)
    if (typeof data === 'string') {
        // 移除 data URL 前缀 (如 "data:text/html;base64,")
        const base64Data = data.includes(',') ? data.split(',')[1] : data;
        return Buffer.from(base64Data, 'base64');
    }

    // 如果是 Blob 对象 (服务端内部使用)
    // 注意：在 Node.js 服务端，Blob 可能不支持 arrayBuffer
    // 因此这种情况应该很少发生
    throw new Error('Blob objects are not supported on server-side. Please convert to Base64 first.');
}

/**
 * Buffer 转 Blob (用于读取)
 */
export function bufferToBlob(buffer: Buffer, type: string = 'application/octet-stream'): Blob {
    return new Blob([buffer], { type });
}

export { pool };
export type { Pool, PoolConnection, ResultSetHeader, RowDataPacket };
