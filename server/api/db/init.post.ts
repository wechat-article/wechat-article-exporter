/**
 * POST /api/db/init
 * 初始化数据库表结构
 */

import { pool } from '~/server/utils/mysql';
import fs from 'fs';
import path from 'path';

export default defineEventHandler(async (event) => {
    try {
        // 读取 schema.sql 文件
        const schemaPath = path.join(process.cwd(), 'server/db/schema.sql');

        if (!fs.existsSync(schemaPath)) {
            return {
                code: -1,
                data: null,
                message: 'Schema file not found',
            };
        }

        const schema = fs.readFileSync(schemaPath, 'utf-8');

        // 分割 SQL 语句并逐条执行
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        const connection = await pool.getConnection();

        try {
            for (const statement of statements) {
                if (statement.trim()) {
                    await connection.query(statement);
                }
            }
        } finally {
            connection.release();
        }

        return {
            code: 0,
            data: { tablesCreated: statements.length },
            message: 'Database initialized successfully',
        };
    } catch (error: any) {
        console.error('Database initialization failed:', error);
        return {
            code: -1,
            data: null,
            message: error.message || 'Database initialization failed',
        };
    }
});
