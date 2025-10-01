import { db } from './db';

// 删除公众号数据
export async function deleteAccountData(ids: string[]): Promise<void> {
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
      // todo: 调后台接口保存最近90天的接口调用情况
      // const apis = await db.api.toArray();
      // console.log('apis', apis);

      db.api.toCollection().delete();
      db.article.where('fakeid').anyOf(ids).delete();
      db.asset.where('fakeid').anyOf(ids).delete();
      db.comment.where('fakeid').anyOf(ids).delete();
      db.comment_reply.where('fakeid').anyOf(ids).delete();
      db.debug.where('fakeid').anyOf(ids).delete();
      db.html.where('fakeid').anyOf(ids).delete();
      db.info.where('fakeid').anyOf(ids).delete();
      db.metadata.where('fakeid').anyOf(ids).delete();
      db.resource.where('fakeid').anyOf(ids).delete();
      db['resource-map'].where('fakeid').anyOf(ids).delete();
    }
  );
}
