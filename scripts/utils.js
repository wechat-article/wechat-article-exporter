// 加载 Dexie
await import('https://unpkg.com/dexie@4.2.1/dist/dexie.js');

const db = new Dexie('exporter.wxdown.online');

db.version(1).stores({
  api: '++, name, account, call_time',
  article: ', fakeid, create_time, link', // 主键 fakeid:aid
  asset: 'url',
  comment: 'url',
  comment_reply: ', url, contentID', // 主键 url:contentID
  debug: 'url',
  html: 'url',
  info: 'fakeid',
  metadata: 'url',
  resource: 'url',
  'resource-map': 'url',
});

db.version(2).stores({
  asset: 'url, fakeid',
  comment: 'url, fakeid',
  comment_reply: ', url, contentID, fakeid',
  html: 'url, fakeid',
  metadata: 'url, fakeid',
  resource: 'url, fakeid',
  'resource-map': 'url, fakeid',
});

db.version(3).stores({
  debug: 'url, fakeid',
});

// 删除公众号数据
async function deleteAccountData(ids, tables) {
  return db.transaction(
    'rw',
    [
      'api',
      'article',
      'asset',
      'comment',
      'comment_reply',
      'debug',
      'html',
      'info',
      'metadata',
      'resource',
      'resource-map',
    ],
    async () => {
      db.api.toCollection().delete();
      db.debug.where('fakeid').anyOf(ids).delete();

      // 删除评论
      if (tables.includes('评论')) {
        db.comment.where('fakeid').anyOf(ids).delete();
        db.comment_reply.where('fakeid').anyOf(ids).delete();
      }

      // 删除阅读量
      if (tables.includes('阅读量')) {
        db.metadata.where('fakeid').anyOf(ids).delete();
      }

      // 删除文章内容
      if (tables.includes('文章内容')) {
        db.asset.where('fakeid').anyOf(ids).delete();
        db.html.where('fakeid').anyOf(ids).delete();
        db.resource.where('fakeid').anyOf(ids).delete();
        db['resource-map'].where('fakeid').anyOf(ids).delete();
      }
    }
  );
}

await deleteAccountData(['MzAxNzcxOTUyMg==', 'MzI5NjcxMDY5Mw=='], ['文章内容', '评论', '阅读量']);
console.log('执行完成');
