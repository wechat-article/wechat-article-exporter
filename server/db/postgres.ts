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
        cover TEXT,
        digest TEXT,
        is_deleted BOOLEAN DEFAULT FALSE,
        data JSONB NOT NULL
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_fakeid ON article (fakeid)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_link ON article (link)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_create_time ON article (create_time)`);
    await client.query(`COMMENT ON TABLE article IS '公众号文章列表表'`);
    await client.query(`COMMENT ON COLUMN article.id IS '文章主键，格式为 fakeid:aid'`);
    await client.query(`COMMENT ON COLUMN article.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN article.link IS '文章链接'`);
    await client.query(`COMMENT ON COLUMN article.create_time IS '文章创建时间'`);
    await client.query(`COMMENT ON COLUMN article.update_time IS '文章更新时间'`);
    await client.query(`COMMENT ON COLUMN article.article_title IS '文章标题'`);
    await client.query(`COMMENT ON COLUMN article.article_status IS '文章发布状态'`);
    await client.query(`COMMENT ON COLUMN article.data IS '微信原始文章 JSON 数据'`);

    // 为已有表添加 update_time 列（兼容旧数据库）
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS update_time BIGINT`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS article_title TEXT`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS article_status INTEGER`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS cover TEXT`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS digest TEXT`);
    await client.query(`ALTER TABLE article ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_article_update_time ON article (update_time)`);
    await client.query(`COMMENT ON COLUMN article.cover IS '预览图'`);
    await client.query(`COMMENT ON COLUMN article.digest IS '摘要'`);
    await client.query(`COMMENT ON COLUMN article.is_deleted IS '是否删除'`);
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
        ),
        cover = COALESCE(
          NULLIF(cover, ''),
          NULLIF(data->>'cover', ''),
          NULLIF(data->>'cover_img', ''),
          NULLIF(data->>'pic_cdn_url_235_1', ''),
          NULLIF(data->>'pic_cdn_url_16_9', ''),
          NULLIF(data->>'pic_cdn_url_3_4', ''),
          NULLIF(data->>'pic_cdn_url_1_1', '')
        ),
        digest = COALESCE(NULLIF(digest, ''), NULLIF(data->>'digest', '')),
        is_deleted = COALESCE(
          is_deleted,
          CASE
            WHEN LOWER(COALESCE(data->>'is_deleted', '')) IN ('true', '1') THEN TRUE
            WHEN LOWER(COALESCE(data->>'is_deleted', '')) IN ('false', '0') THEN FALSE
            ELSE FALSE
          END
        )
      WHERE article_title IS NULL OR article_title = ''
        OR article_status IS NULL
        OR cover IS NULL OR cover = ''
        OR digest IS NULL OR digest = ''
        OR is_deleted IS NULL
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
        is_interface BOOLEAN DEFAULT FALSE,
        status TEXT,
        is_delete BOOLEAN DEFAULT FALSE,
        create_time BIGINT,
        update_time BIGINT,
        last_update_time BIGINT
      )
    `);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS service_type INTEGER`);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS is_semiconductor INTEGER DEFAULT 0`);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS is_interface BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS status TEXT`);
    await client.query(`ALTER TABLE info ADD COLUMN IF NOT EXISTS is_delete BOOLEAN DEFAULT FALSE`);
    await client.query(`ALTER TABLE info ALTER COLUMN is_semiconductor SET DEFAULT 0`);
    await client.query(`ALTER TABLE info ALTER COLUMN status DROP DEFAULT`);
    await client.query(`UPDATE info SET is_semiconductor = 0 WHERE is_semiconductor IS NULL`);
    await client.query(`UPDATE info SET is_interface = FALSE WHERE is_interface IS NULL`);
    await client.query(`UPDATE info SET status = NULL WHERE status IS NOT NULL AND BTRIM(status) = ''`);
    await client.query(`
      UPDATE info
      SET status = NULL
      WHERE status = 'queued'
        AND COALESCE(is_interface, FALSE) = FALSE
        AND COALESCE(is_delete, FALSE) = FALSE
        AND COALESCE(completed, FALSE) = FALSE
        AND COALESCE(count, 0) = 0
        AND COALESCE(articles, 0) = 0
        AND COALESCE(total_count, 0) = 0
    `);
    await client.query(`UPDATE info SET is_delete = FALSE WHERE is_delete IS NULL`);
    await client.query(`COMMENT ON TABLE info IS '公众号信息表'`);
    await client.query(`COMMENT ON COLUMN info.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN info.completed IS '是否已完成历史文章同步'`);
    await client.query(`COMMENT ON COLUMN info.count IS '已同步消息数'`);
    await client.query(`COMMENT ON COLUMN info.articles IS '已同步文章数'`);
    await client.query(`COMMENT ON COLUMN info.nickname IS '公众号名称'`);
    await client.query(`COMMENT ON COLUMN info.round_head_img IS '公众号头像地址'`);
    await client.query(`COMMENT ON COLUMN info.service_type IS '公众号类型'`);
    await client.query(`COMMENT ON COLUMN info.is_semiconductor IS '是否半导体行业公众号'`);
    await client.query(`COMMENT ON COLUMN info.total_count IS '公众号消息总数'`);
    await client.query(`COMMENT ON COLUMN info.is_interface IS '是否通过对外接口添加'`);
    await client.query(`COMMENT ON COLUMN info.status IS '同步状态：queued=排队中，syncing=同步中，success=同步成功，failed=同步失败；为空表示未开始同步'`);
    await client.query(`COMMENT ON COLUMN info.is_delete IS '是否禁用公众号'`);
    await client.query(`COMMENT ON COLUMN info.create_time IS '记录创建时间'`);
    await client.query(`COMMENT ON COLUMN info.update_time IS '最近一次同步数据更新时间'`);
    await client.query(`COMMENT ON COLUMN info.last_update_time IS '最近一次触发同步时间'`);

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
    await client.query(`COMMENT ON TABLE html IS '文章 HTML 内容表'`);
    await client.query(`COMMENT ON COLUMN html.url IS '文章链接'`);
    await client.query(`COMMENT ON COLUMN html.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN html.title IS '文章标题'`);
    await client.query(`COMMENT ON COLUMN html.comment_id IS '文章评论 id'`);
    await client.query(`COMMENT ON COLUMN html.file IS 'HTML 文件二进制内容'`);
    await client.query(`COMMENT ON COLUMN html.file_type IS '文件类型'`);

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
    await client.query(`COMMENT ON TABLE metadata IS '文章元数据表'`);
    await client.query(`COMMENT ON COLUMN metadata.url IS '文章链接'`);
    await client.query(`COMMENT ON COLUMN metadata.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN metadata.title IS '文章标题'`);
    await client.query(`COMMENT ON COLUMN metadata.data IS '文章元数据 JSON 数据'`);

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
    await client.query(`COMMENT ON TABLE comment IS '文章评论表'`);
    await client.query(`COMMENT ON COLUMN comment.url IS '文章链接'`);
    await client.query(`COMMENT ON COLUMN comment.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN comment.title IS '文章标题'`);
    await client.query(`COMMENT ON COLUMN comment.data IS '评论 JSON 数据'`);

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
    await client.query(`COMMENT ON TABLE comment_reply IS '评论回复表'`);
    await client.query(`COMMENT ON COLUMN comment_reply.id IS '评论回复主键'`);
    await client.query(`COMMENT ON COLUMN comment_reply.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN comment_reply.url IS '文章链接'`);
    await client.query(`COMMENT ON COLUMN comment_reply.title IS '文章标题'`);
    await client.query(`COMMENT ON COLUMN comment_reply.content_id IS '评论内容 id'`);
    await client.query(`COMMENT ON COLUMN comment_reply.data IS '评论回复 JSON 数据'`);

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
    await client.query(`COMMENT ON TABLE resource IS '文章资源文件表'`);
    await client.query(`COMMENT ON COLUMN resource.url IS '资源原始链接'`);
    await client.query(`COMMENT ON COLUMN resource.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN resource.file IS '资源文件二进制内容'`);
    await client.query(`COMMENT ON COLUMN resource.file_type IS '资源文件类型'`);

    // resource_map 表 (资源映射)
    await client.query(`
      CREATE TABLE IF NOT EXISTS resource_map (
        url TEXT PRIMARY KEY,
        fakeid TEXT NOT NULL,
        resources JSONB
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_resource_map_fakeid ON resource_map (fakeid)`);
    await client.query(`COMMENT ON TABLE resource_map IS '文章资源映射表'`);
    await client.query(`COMMENT ON COLUMN resource_map.url IS '文章链接'`);
    await client.query(`COMMENT ON COLUMN resource_map.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN resource_map.resources IS '文章资源映射 JSON 数据'`);

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
    await client.query(`COMMENT ON TABLE asset IS '文章附属资源表'`);
    await client.query(`COMMENT ON COLUMN asset.url IS '资源链接'`);
    await client.query(`COMMENT ON COLUMN asset.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN asset.file IS '资源文件二进制内容'`);
    await client.query(`COMMENT ON COLUMN asset.file_type IS '资源文件类型'`);

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
    await client.query(`COMMENT ON TABLE debug IS '调试输出表'`);
    await client.query(`COMMENT ON COLUMN debug.url IS '调试对象链接'`);
    await client.query(`COMMENT ON COLUMN debug.fakeid IS '公众号 fakeid'`);
    await client.query(`COMMENT ON COLUMN debug.type IS '调试文件类型标识'`);
    await client.query(`COMMENT ON COLUMN debug.title IS '调试标题'`);
    await client.query(`COMMENT ON COLUMN debug.file IS '调试文件二进制内容'`);
    await client.query(`COMMENT ON COLUMN debug.file_type IS '调试文件 MIME 类型'`);

    // session 表 (登录会话，替代 KV 存储)
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        auth_key TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        cookies JSONB NOT NULL,
        nickname TEXT,
        avatar TEXT,
        created_at BIGINT NOT NULL,
        expires_at BIGINT NOT NULL
      )
    `);
    await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS nickname TEXT`);
    await client.query(`ALTER TABLE session ADD COLUMN IF NOT EXISTS avatar TEXT`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_session_expires_at ON session (expires_at)`);
    await client.query(`COMMENT ON TABLE session IS '微信公众号平台登录会话表'`);
    await client.query(`COMMENT ON COLUMN session.auth_key IS '服务端签发的登录会话标识'`);
    await client.query(`COMMENT ON COLUMN session.token IS '微信公众号平台 token'`);
    await client.query(`COMMENT ON COLUMN session.cookies IS '微信公众号平台登录 cookies'`);
    await client.query(`COMMENT ON COLUMN session.nickname IS '当前登录公众号名称'`);
    await client.query(`COMMENT ON COLUMN session.avatar IS '当前登录公众号头像地址'`);
    await client.query(`COMMENT ON COLUMN session.created_at IS '会话创建时间'`);
    await client.query(`COMMENT ON COLUMN session.expires_at IS '会话过期时间'`);

    // preferences 表 (用户偏好设置)
    await client.query(`
      CREATE TABLE IF NOT EXISTS preferences (
        id TEXT PRIMARY KEY DEFAULT 'default',
        data JSONB NOT NULL,
        update_time BIGINT
      )
    `);
    await client.query(`COMMENT ON TABLE preferences IS '用户偏好设置表'`);
    await client.query(`COMMENT ON COLUMN preferences.id IS '偏好设置主键'`);
    await client.query(`COMMENT ON COLUMN preferences.data IS '偏好设置 JSON 数据'`);
    await client.query(`COMMENT ON COLUMN preferences.update_time IS '偏好设置更新时间'`);

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
