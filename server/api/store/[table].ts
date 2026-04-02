import { getPool } from '~/server/db/postgres';

/**
 * 统一的数据库存储 API 端点
 *
 * POST /api/store/[table]
 * GET  /api/store/[table]?action=xxx&...
 */
export default defineEventHandler(async (event) => {
  const table = getRouterParam(event, 'table');
  if (!table) {
    throw createError({ statusCode: 400, message: 'Missing table parameter' });
  }

  const method = getMethod(event);
  const pool = getPool();

  try {
    if (method === 'GET') {
      const query = getQuery(event);
      const action = query.action as string;
      return await handleGet(pool, table, action, query);
    } else if (method === 'POST') {
      const body = await readBody(event);
      return await handlePost(pool, table, body.action, body);
    }
    throw createError({ statusCode: 405, message: 'Method not allowed' });
  } catch (e: any) {
    if (e.statusCode) throw e;
    console.error(`[DB API] Error: ${table}/${method}`, e);
    throw createError({ statusCode: 500, message: e.message || 'Internal server error' });
  }
});

// ============ GET 处理 ============

async function handleGet(pool: any, table: string, action: string, query: any) {
  switch (table) {
    case 'article':
      return handleArticleGet(pool, action, query);
    case 'info':
      return handleInfoGet(pool, action, query);
    case 'html':
      return handleHtmlGet(pool, action, query);
    case 'metadata':
      return handleMetadataGet(pool, action, query);
    case 'comment':
      return handleCommentGet(pool, action, query);
    case 'comment-reply':
      return handleCommentReplyGet(pool, action, query);
    case 'resource':
      return handleResourceGet(pool, action, query);
    case 'resource-map':
      return handleResourceMapGet(pool, action, query);
    case 'asset':
      return handleAssetGet(pool, action, query);
    case 'debug':
      return handleDebugGet(pool, action, query);
    default:
      throw createError({ statusCode: 400, message: `Unknown table: ${table}` });
  }
}

// ============ POST 处理 ============

async function handlePost(pool: any, table: string, action: string, body: any) {
  switch (table) {
    case 'article':
      return handleArticlePost(pool, action, body);
    case 'info':
      return handleInfoPost(pool, action, body);
    case 'html':
      return handleHtmlPost(pool, action, body);
    case 'metadata':
      return handleMetadataPost(pool, action, body);
    case 'comment':
      return handleCommentPost(pool, action, body);
    case 'comment-reply':
      return handleCommentReplyPost(pool, action, body);
    case 'resource':
      return handleResourcePost(pool, action, body);
    case 'resource-map':
      return handleResourceMapPost(pool, action, body);
    case 'asset':
      return handleAssetPost(pool, action, body);
    case 'debug':
      return handleDebugPost(pool, action, body);
    case 'account':
      return handleAccountPost(pool, action, body);
    default:
      throw createError({ statusCode: 400, message: `Unknown table: ${table}` });
  }
}

// ==================== Article ====================

async function handleArticleGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'hitCache': {
      const { fakeid, create_time } = query;
      const res = await pool.query(
        `SELECT COUNT(*) as count FROM article WHERE fakeid = $1 AND create_time < $2`,
        [fakeid, Number(create_time)]
      );
      return { hit: Number(res.rows[0].count) > 0 };
    }
    case 'getCache': {
      const { fakeid, create_time } = query;
      const res = await pool.query(
        `SELECT data FROM article WHERE fakeid = $1 AND create_time < $2 ORDER BY create_time DESC`,
        [fakeid, Number(create_time)]
      );
      return res.rows.map((r: any) => r.data);
    }
    case 'byLink': {
      const { url } = query;
      const res = await pool.query(`SELECT data FROM article WHERE link = $1 LIMIT 1`, [url]);
      if (res.rows.length === 0) return null;
      return res.rows[0].data;
    }
    case 'singleByLink': {
      const { url } = query;
      const res = await pool.query(
        `SELECT data FROM article WHERE link = $1 AND data->>'fakeid' = 'SINGLE_ARTICLE_FAKEID' LIMIT 1`,
        [url]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].data;
    }
    case 'allKeys': {
      const res = await pool.query(`SELECT id FROM article`);
      return res.rows.map((r: any) => r.id);
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown article action: ${action}` });
  }
}

async function handleArticlePost(pool: any, action: string, body: any) {
  switch (action) {
    case 'updateCache': {
      // 复杂事务: 更新文章缓存 + 更新 info 缓存
      const { account, publishPage } = body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const fakeid = account.fakeid;
        const totalCount = publishPage.total_count;
        const publishList = publishPage.publish_list.filter((item: any) => !!item.publish_info);

        // 获取现有 keys
        const keysRes = await client.query(`SELECT id FROM article`);
        const existingKeys = new Set(keysRes.rows.map((r: any) => r.id));

        let msgCount = 0;
        let articleCount = 0;

        for (const item of publishList) {
          const publishInfo = JSON.parse(item.publish_info);
          let newEntryCount = 0;

          for (const article of publishInfo.appmsgex) {
            const key = `${fakeid}:${article.aid}`;
            const data = { ...article, fakeid, _status: '' };

            const res = await client.query(
              `INSERT INTO article (id, fakeid, link, create_time, data)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (id) DO UPDATE SET
                 fakeid = EXCLUDED.fakeid,
                 link = EXCLUDED.link,
                 create_time = EXCLUDED.create_time,
                 data = EXCLUDED.data
               RETURNING (xmax = 0) AS is_new`,
              [key, fakeid, article.link, article.create_time, data]
            );

            if (res.rows[0].is_new) {
              newEntryCount++;
              articleCount++;
            }
          }

          if (newEntryCount > 0) {
            msgCount++;
          }
        }

        // 更新 info 缓存
        await upsertInfo(client, {
          fakeid,
          completed: publishList.length === 0,
          count: msgCount,
          articles: articleCount,
          nickname: account.nickname,
          round_head_img: account.round_head_img,
          total_count: totalCount,
        });

        await client.query('COMMIT');
        return { success: true, msgCount, articleCount };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    case 'put': {
      const { id, data } = body;
      const fakeid = data.fakeid || '';
      const link = data.link || null;
      const createTime = data.create_time || null;
      await pool.query(
        `INSERT INTO article (id, fakeid, link, create_time, data)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           link = EXCLUDED.link,
           create_time = EXCLUDED.create_time,
           data = EXCLUDED.data`,
        [id, fakeid, link, createTime, data]
      );
      return { success: true };
    }
    case 'deleted': {
      const { url, is_deleted } = body;
      await pool.query(
        `UPDATE article SET data = jsonb_set(data, '{is_deleted}', $2::jsonb) WHERE link = $1`,
        [url, JSON.stringify(is_deleted !== false)]
      );
      return { success: true };
    }
    case 'updateStatus': {
      const { url, status } = body;
      await pool.query(
        `UPDATE article SET data = jsonb_set(data, '{_status}', $2::jsonb) WHERE link = $1`,
        [url, JSON.stringify(status)]
      );
      return { success: true };
    }
    case 'updateFakeid': {
      const { url, fakeid } = body;
      await pool.query(
        `UPDATE article SET
           fakeid = $2,
           data = data || jsonb_build_object('fakeid', $2::text, '_single', true)
         WHERE link = $1 AND data->>'fakeid' = 'SINGLE_ARTICLE_FAKEID'`,
        [url, fakeid]
      );
      return { success: true };
    }
    case 'delete': {
      const { id } = body;
      await pool.query(`DELETE FROM article WHERE id = $1`, [id]);
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown article action: ${action}` });
  }
}

// ==================== Info ====================

/**
 * info 表 upsert 逻辑（在事务中复用）
 */
async function upsertInfo(client: any, mpAccount: any) {
  const existing = await client.query(`SELECT * FROM info WHERE fakeid = $1`, [mpAccount.fakeid]);
  if (existing.rows.length > 0) {
    const row = existing.rows[0];
    const newCompleted = mpAccount.completed ? true : row.completed;
    await client.query(
      `UPDATE info SET
         completed = $2,
         count = count + $3,
         articles = articles + $4,
         nickname = COALESCE($5, nickname),
         round_head_img = COALESCE($6, round_head_img),
         total_count = $7,
         update_time = $8
       WHERE fakeid = $1`,
      [
        mpAccount.fakeid,
        newCompleted,
        mpAccount.count,
        mpAccount.articles,
        mpAccount.nickname,
        mpAccount.round_head_img,
        mpAccount.total_count,
        Math.round(Date.now() / 1000),
      ]
    );
  } else {
    const now = Math.round(Date.now() / 1000);
    await client.query(
      `INSERT INTO info (fakeid, completed, count, articles, nickname, round_head_img, total_count, create_time, update_time)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        mpAccount.fakeid,
        mpAccount.completed,
        mpAccount.count,
        mpAccount.articles,
        mpAccount.nickname,
        mpAccount.round_head_img,
        mpAccount.total_count,
        now,
        now,
      ]
    );
  }
}

async function handleInfoGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { fakeid } = query;
      const res = await pool.query(`SELECT * FROM info WHERE fakeid = $1`, [fakeid]);
      if (res.rows.length === 0) return null;
      return toInfoObject(res.rows[0]);
    }
    case 'all': {
      const res = await pool.query(`SELECT * FROM info`);
      return res.rows.map(toInfoObject);
    }
    case 'accountName': {
      const { fakeid } = query;
      const res = await pool.query(`SELECT nickname FROM info WHERE fakeid = $1`, [fakeid]);
      if (res.rows.length === 0) return null;
      return res.rows[0].nickname || null;
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown info action: ${action}` });
  }
}

function toInfoObject(row: any) {
  return {
    fakeid: row.fakeid,
    completed: row.completed,
    count: row.count,
    articles: row.articles,
    nickname: row.nickname,
    round_head_img: row.round_head_img,
    total_count: row.total_count,
    create_time: row.create_time ? Number(row.create_time) : undefined,
    update_time: row.update_time ? Number(row.update_time) : undefined,
    last_update_time: row.last_update_time ? Number(row.last_update_time) : undefined,
  };
}

async function handleInfoPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await upsertInfo(client, body.mpAccount);
        await client.query('COMMIT');
        return { success: true };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    case 'updateLastTime': {
      const { fakeid } = body;
      const now = Math.round(Date.now() / 1000);
      await pool.query(`UPDATE info SET last_update_time = $2 WHERE fakeid = $1`, [fakeid, now]);
      return { success: true };
    }
    case 'import': {
      const { mpAccounts } = body;
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const mpAccount of mpAccounts) {
          mpAccount.completed = false;
          mpAccount.count = 0;
          mpAccount.articles = 0;
          mpAccount.total_count = 0;
          mpAccount.create_time = undefined;
          mpAccount.update_time = undefined;
          mpAccount.last_update_time = undefined;
          await upsertInfo(client, mpAccount);
        }
        await client.query('COMMIT');
        return { success: true };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown info action: ${action}` });
  }
}

// ==================== HTML ====================

async function handleHtmlGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM html WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        fakeid: row.fakeid,
        url: row.url,
        title: row.title,
        commentID: row.comment_id,
        file: row.file ? Buffer.from(row.file).toString('base64') : null,
        fileType: row.file_type || 'text/html',
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown html action: ${action}` });
  }
}

async function handleHtmlPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { fakeid, url, title, commentID, file, fileType } = body;
      const fileBuf = file ? Buffer.from(file, 'base64') : null;
      await pool.query(
        `INSERT INTO html (url, fakeid, title, comment_id, file, file_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           title = EXCLUDED.title,
           comment_id = EXCLUDED.comment_id,
           file = EXCLUDED.file,
           file_type = EXCLUDED.file_type`,
        [url, fakeid, title, commentID, fileBuf, fileType || 'text/html']
      );
      return { success: true };
    }
    case 'delete': {
      const { url } = body;
      await pool.query(`DELETE FROM html WHERE url = $1`, [url]);
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown html action: ${action}` });
  }
}

// ==================== Metadata ====================

async function handleMetadataGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM metadata WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row.data,
        fakeid: row.fakeid,
        url: row.url,
        title: row.title,
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown metadata action: ${action}` });
  }
}

async function handleMetadataPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { fakeid, url, title, ...rest } = body.metadata;
      // 从 rest 中移除 action 字段
      delete rest.action;
      await pool.query(
        `INSERT INTO metadata (url, fakeid, title, data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           title = EXCLUDED.title,
           data = EXCLUDED.data`,
        [url, fakeid, title, rest]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown metadata action: ${action}` });
  }
}

// ==================== Comment ====================

async function handleCommentGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM comment WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        fakeid: row.fakeid,
        url: row.url,
        title: row.title,
        data: row.data,
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown comment action: ${action}` });
  }
}

async function handleCommentPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { fakeid, url, title, data } = body.comment;
      await pool.query(
        `INSERT INTO comment (url, fakeid, title, data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           title = EXCLUDED.title,
           data = EXCLUDED.data`,
        [url, fakeid, title, JSON.stringify(data)]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown comment action: ${action}` });
  }
}

// ==================== Comment Reply ====================

async function handleCommentReplyGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url, contentID } = query;
      const id = `${url}:${contentID}`;
      const res = await pool.query(`SELECT * FROM comment_reply WHERE id = $1`, [id]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        fakeid: row.fakeid,
        url: row.url,
        title: row.title,
        data: row.data,
        contentID: row.content_id,
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown comment-reply action: ${action}` });
  }
}

async function handleCommentReplyPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { fakeid, url, title, data, contentID } = body.reply;
      const id = `${url}:${contentID}`;
      await pool.query(
        `INSERT INTO comment_reply (id, fakeid, url, title, content_id, data)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           url = EXCLUDED.url,
           title = EXCLUDED.title,
           content_id = EXCLUDED.content_id,
           data = EXCLUDED.data`,
        [id, fakeid, url, title, contentID, JSON.stringify(data)]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown comment-reply action: ${action}` });
  }
}

// ==================== Resource ====================

async function handleResourceGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM resource WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        fakeid: row.fakeid,
        url: row.url,
        file: row.file ? Buffer.from(row.file).toString('base64') : null,
        fileType: row.file_type,
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown resource action: ${action}` });
  }
}

async function handleResourcePost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { fakeid, url, file, fileType } = body.resource;
      const fileBuf = file ? Buffer.from(file, 'base64') : null;
      await pool.query(
        `INSERT INTO resource (url, fakeid, file, file_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           file = EXCLUDED.file,
           file_type = EXCLUDED.file_type`,
        [url, fakeid, fileBuf, fileType]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown resource action: ${action}` });
  }
}

// ==================== Resource Map ====================

async function handleResourceMapGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM resource_map WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        fakeid: row.fakeid,
        url: row.url,
        resources: row.resources,
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown resource-map action: ${action}` });
  }
}

async function handleResourceMapPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { fakeid, url, resources } = body.resourceMap;
      await pool.query(
        `INSERT INTO resource_map (url, fakeid, resources)
         VALUES ($1, $2, $3)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           resources = EXCLUDED.resources`,
        [url, fakeid, JSON.stringify(resources)]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown resource-map action: ${action}` });
  }
}

// ==================== Asset ====================

async function handleAssetGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM asset WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        url: row.url,
        fakeid: row.fakeid,
        file: row.file ? Buffer.from(row.file).toString('base64') : null,
        fileType: row.file_type,
      };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown asset action: ${action}` });
  }
}

async function handleAssetPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { url, fakeid, file, fileType } = body.asset;
      const fileBuf = file ? Buffer.from(file, 'base64') : null;
      await pool.query(
        `INSERT INTO asset (url, fakeid, file, file_type)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           file = EXCLUDED.file,
           file_type = EXCLUDED.file_type`,
        [url, fakeid, fileBuf, fileType]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown asset action: ${action}` });
  }
}

// ==================== Debug ====================

async function handleDebugGet(pool: any, action: string, query: any) {
  switch (action) {
    case 'get': {
      const { url } = query;
      const res = await pool.query(`SELECT * FROM debug WHERE url = $1`, [url]);
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return toDebugObject(row);
    }
    case 'all': {
      const res = await pool.query(`SELECT * FROM debug`);
      return res.rows.map(toDebugObject);
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown debug action: ${action}` });
  }
}

function toDebugObject(row: any) {
  return {
    type: row.type,
    url: row.url,
    fakeid: row.fakeid,
    title: row.title,
    file: row.file ? Buffer.from(row.file).toString('base64') : null,
    fileType: row.file_type,
  };
}

async function handleDebugPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'update': {
      const { type, url, fakeid, title, file, fileType } = body.debug;
      const fileBuf = file ? Buffer.from(file, 'base64') : null;
      await pool.query(
        `INSERT INTO debug (url, fakeid, type, title, file, file_type)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (url) DO UPDATE SET
           fakeid = EXCLUDED.fakeid,
           type = EXCLUDED.type,
           title = EXCLUDED.title,
           file = EXCLUDED.file,
           file_type = EXCLUDED.file_type`,
        [url, fakeid, type, title, fileBuf, fileType]
      );
      return { success: true };
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown debug action: ${action}` });
  }
}

// ==================== Account (deleteAccountData) ====================

async function handleAccountPost(pool: any, action: string, body: any) {
  switch (action) {
    case 'delete': {
      const { ids } = body;
      if (!ids || ids.length === 0) return { success: true };

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const placeholders = ids.map((_: any, i: number) => `$${i + 1}`).join(', ');

        await client.query(`DELETE FROM article WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM asset WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM comment WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM comment_reply WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM debug WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM html WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM info WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM metadata WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM resource WHERE fakeid IN (${placeholders})`, ids);
        await client.query(`DELETE FROM resource_map WHERE fakeid IN (${placeholders})`, ids);

        await client.query('COMMIT');
        return { success: true };
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
    default:
      throw createError({ statusCode: 400, message: `Unknown account action: ${action}` });
  }
}
