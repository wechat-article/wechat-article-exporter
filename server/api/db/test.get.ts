/**
 * GET /api/db/test
 * 测试数据库连接
 */

import { testConnection } from '~/server/utils/mysql';

export default defineEventHandler(async (event) => {
    try {
        const connected = await testConnection();

        return {
            code: connected ? 0 : -1,
            data: { connected },
            message: connected ? 'Database connection successful' : 'Database connection failed',
        };
    } catch (error: any) {
        console.error('Database test failed:', error);
        return {
            code: -1,
            data: { connected: false },
            message: error.message || 'Database test failed',
        };
    }
});
