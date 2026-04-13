import pg from 'pg';

const { Pool, Client } = pg;

let pool: pg.Pool | null = null;

function getConfig() {
  return {
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    user: process.env.PG_USER || 'postgres',
    password: process.env.PG_PASSWORD || 'postgres',
    database: process.env.PG_DATABASE || 'wae_db',
  };
}

/**
 * 获取数据库连接池
 */
export function getPool(): pg.Pool {
  if (!pool) {
    const config = getConfig();
    pool = new Pool(config);
  }
  return pool;
}

/**
 * 初始化数据库：创建数据库（如果不存在）+ 创建表结构
 */
export async function initDatabase(): Promise<void> {
  const config = getConfig();

  // 1. 连接到默认 postgres 数据库，创建目标数据库
  const adminClient = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: 'postgres',
  });

  try {
    await adminClient.connect();
    const res = await adminClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [config.database]);
    if (res.rowCount === 0) {
      await adminClient.query(`CREATE DATABASE "${config.database}"`);
      console.log(`[DB] 数据库 ${config.database} 创建成功`);
    } else {
      console.log(`[DB] 数据库 ${config.database} 已存在`);
    }
  } finally {
    await adminClient.end();
  }

  // 2. 连接到目标数据库，创建表结构
  const dbPool = getPool();
  await createTables(dbPool);
}

/**
 * 创建所有表
 */
async function createTables(pool: pg.Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // article 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS article (
        id TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        link TEXT,
        create_time BIGINT,
        update_time BIGINT,
        article_title TEXT,
        article_status INTEGER,
        data JSONB NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_fakeid ON article (fakeid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_link ON article (link)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_create_time ON article (create_time)`);

    // 为已有表添加 update_time 列（兼容旧数据库）
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS update_time BIGINT`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS article_title TEXT`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS article_status INTEGER`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_update_time ON article (update_time)`);
    await client.query(`
      UPDATE article
      SET
        article_title = COALESCE(NULLIF(article_title, ''), data->>'title'),
        article_status = COALESCE(
          article_status,
          CASE
            WHEN (data->>'mediaapi_publish_status') ~ '^-?\\d+$' THEN (data->>'mediaapi_publish_status')::INTEGER
            ELSE NULL
          END
        )
      WHERE article_title IS NULL OR article_title = '' OR article_status IS NULL
    `);

    // info 表 (公众号元数据)
    await client.query(`
      CREATE TABLE IF NOT EXISTS info (
        fakeid TEXT PRIMARY KEY,
        completed BOOLEAN DEFAULT FALSE,
        count INTEGER DEFAULT 0,
        articles INTEGER DEFAULT 0,
        nickname TEXT,
        round_head_img TEXT,
        service_type INTEGER,
        is_semiconductor INTEGER DEFAULT 0,
        total_count INTEGER DEFAULT 0,
        create_time BIGINT,
        update_time BIGINT,
        last_update_time BIGINT
      )
    `);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS service_type INTEGER`);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS is_semiconductor INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE info ALTER COLUMN is_semiconductor SET DEFAULT 0`);
    await client.query(`UPDATE info SET is_semiconductor = 0 WHERE is_semiconductor IS NULL`);

    // html 表 (文章HTML内容)
    await client.query(`
      CREATE TABLE IF NOT EXISTS html (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        title TEXT,
        comment_id TEXT,
        file BYTEA,
        file_type TEXT DEFAULT 'text/html'
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_html_fakeid ON html (fakeid)`);

    // metadata 表 (阅读量等统计)
    await client.query(`
      CREATE TABLE IF NOT EXISTS metadata (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        title TEXT,
        data JSONB NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_metadata_fakeid ON metadata (fakeid)`);

    // comment 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS comment (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        title TEXT,
        data JSONB
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_fakeid ON comment (fakeid)`);

    // comment_reply 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS comment_reply (
        id TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        url TEXT NOT NULL,
        title TEXT,
        content_id TEXT NOT NULL,
        data JSONB
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_reply_fakeid ON comment_reply (fakeid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_comment_reply_url ON comment_reply (url)`);

    // resource 表 (下载的资源文件)
    await client.query(`
      CREATE TABLE IF NOT EXISTS resource (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        file BYTEA,
        file_type TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resource_fakeid ON resource (fakeid)`);

    // resource_map 表 (资源映射)
    await client.query(`
      CREATE TABLE IF NOT EXISTS resource_map (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        resources JSONB
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resource_map_fakeid ON resource_map (fakeid)`);

    // asset 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS asset (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        file BYTEA,
        file_type TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_asset_fakeid ON asset (fakeid)`);

    // debug 表
    await client.query(`
      CREATE TABLE IF NOT EXISTS debug (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        type TEXT,
        title TEXT,
        file BYTEA,
        file_type TEXT
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_debug_fakeid ON debug (fakeid)`);

    // session 表 (登录会话，替代 KV 存储)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        auth_key TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        cookies JSONB NOT NULL,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session (expires_at)`);

    // preferences 表 (用户偏好设置)
    await client.query(`
      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY DEFAULT 'default',
        data JSONB NOT NULL,
        update_time BIGINT
      )
    `);

    await client.query('COMMIT');
    console.log('[DB] 所有表创建完成');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/**
 * 关闭连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
