type Migration = (db: IDBDatabase, transaction: IDBTransaction, oldVersion: number) => void;

const migrations: Migration[] = [
  // version: 1
  (db, transaction) => {
    // 主键需要通过组合 fakeid:appmsgid 显式设置
    const articleStore = db.createObjectStore('article');
    articleStore.createIndex('fakeid', 'fakeid');
    articleStore.createIndex('link', 'link');
    articleStore.createIndex('fakeid_create_time', ['fakeid', 'create_time']);

    db.createObjectStore('info', { keyPath: 'fakeid' });
    db.createObjectStore('asset', { keyPath: 'url' });

    const apiStore = db.createObjectStore('api', { autoIncrement: true });
    apiStore.createIndex('account', 'account');
    apiStore.createIndex('account_call_time', ['account', 'call_time']);

    db.createObjectStore('debug', { keyPath: 'url' });
    db.createObjectStore('html', { keyPath: 'url' });
    db.createObjectStore('metadata', { keyPath: 'url' });
    db.createObjectStore('comment', { keyPath: 'url' });
    db.createObjectStore('resource', { keyPath: 'url' });
    db.createObjectStore('resource-map', { keyPath: 'url' });
  },

  // version: 2
  (db, transaction) => {
    // 主键需要通过组合 url:content_id 显示设置
    db.createObjectStore('comment_reply');
  },
];

export function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open('exporter.wxdown.online', migrations.length);

    request.onerror = evt => {
      console.error('Database error:', evt);
      reject(new Error('Failed to open database'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = event => {
      const db = request.result;
      const transaction = request.transaction!;
      const oldVersion = event.oldVersion;

      for (let i = oldVersion; i < migrations.length; i++) {
        migrations[i](db, transaction, oldVersion);
      }
    };
  });
}
