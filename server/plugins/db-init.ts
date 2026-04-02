import { initDatabase } from '~/server/db/postgres';

export default defineNitroPlugin(async () => {
  try {
    await initDatabase();
    console.log('[DB] PostgreSQL 数据库初始化完成');
  } catch (error) {
    console.error('[DB] PostgreSQL 数据库初始化失败:', error);
  }
});
