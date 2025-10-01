import Dexie, { type EntityTable, type Table } from 'dexie';
import type { APICall } from './api';
import type { Asset } from './assets';
import type { CommentAsset } from './comment';
import type { CommentReplyAsset } from './comment_reply';
import type { DebugAsset } from './debug';
import type { HtmlAsset } from './html';
import type { Info } from './info';
import type { Metadata } from './metadata';
import type { ResourceAsset } from './resource';
import type { ResourceMapAsset } from './resource-map';
import type { ArticleAsset } from './article';

const db = new Dexie('exporter.wxdown.online') as Dexie & {
  api: EntityTable<APICall>;
  article: Table<ArticleAsset, string>;
  asset: EntityTable<Asset, 'url'>;
  comment: EntityTable<CommentAsset, 'url'>;
  comment_reply: Table<CommentReplyAsset, string>;
  debug: EntityTable<DebugAsset, 'url'>;
  html: EntityTable<HtmlAsset, 'url'>;
  info: EntityTable<Info, 'fakeid'>;
  metadata: EntityTable<Metadata, 'url'>;
  resource: EntityTable<ResourceAsset, 'url'>;
  'resource-map': EntityTable<ResourceMapAsset, 'url'>;
};

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

export { db };
