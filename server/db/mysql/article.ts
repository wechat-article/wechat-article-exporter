/**
 * MySQL 存储层实现 - Article 表
 * 文章缓存管理 (支持多账号隔离)
 */

import { query, execute } from '../../utils/mysql';
import type { ArticleAsset, Info } from '../../../store/v3/types';
import { updateInfo } from './info';
import type { PublishPage, PublishInfo, AppMsgExWithFakeID } from '~/types/types';
import type { RowDataPacket } from 'mysql2/promise';

interface ArticleRow extends RowDataPacket {
    owner_id: string;
    id: string;
    fakeid: string;
    aid: string;
    title: string;
    link: string;
    cover: string;
    digest: string;
    author_name: string;
    create_time: number;
    update_time: number;
    is_deleted: number;
    data: string;
}

/**
 * 将数据库行转换为 ArticleAsset
 */
function rowToArticle(row: ArticleRow): AppMsgExWithFakeID {
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    return {
        ...data,
        fakeid: row.fakeid,
    };
}

/**
 * 更新文章缓存
 */
export async function updateArticleCache(ownerId: string, account: Info, publishPage: PublishPage): Promise<void> {
    const fakeid = account.fakeid;
    const totalCount = publishPage.total_count;
    const publishList = publishPage.publish_list.filter(item => !!item.publish_info);

    let msgCount = 0;
    let articleCount = 0;

    for (const item of publishList) {
        const publishInfo: PublishInfo = JSON.parse(item.publish_info);
        let newEntryCount = 0;

        for (const article of publishInfo.appmsgex) {
            const id = `${fakeid}:${article.aid}`;

            // 检查是否已存在
            const existing = await query<RowDataPacket[]>(
                'SELECT id FROM article WHERE owner_id = ? AND id = ?',
                [ownerId, id]
            );

            if (existing.length === 0) {
                // 插入新文章
                await execute(
                    `INSERT INTO article (owner_id, id, fakeid, aid, title, link, cover, digest, author_name, create_time, update_time, is_deleted, data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        ownerId,
                        id,
                        fakeid,
                        article.aid,
                        article.title,
                        article.link,
                        article.cover,
                        article.digest,
                        article.author_name,
                        article.create_time,
                        article.update_time,
                        article.is_deleted ? 1 : 0,
                        JSON.stringify({ ...article, fakeid }),
                    ]
                );
                newEntryCount++;
                articleCount++;
            }
        }

        if (newEntryCount > 0) {
            msgCount++;
        }
    }

    // 更新 Info
    await updateInfo(ownerId, {
        fakeid: fakeid,
        completed: publishList.length === 0,
        count: msgCount,
        articles: articleCount,
        nickname: account.nickname,
        round_head_img: account.round_head_img,
        total_count: totalCount,
    });
}

/**
 * 检查是否存在指定时间之前的缓存
 */
export async function hitCache(ownerId: string, fakeid: string, createTime: number): Promise<boolean> {
    const rows = await query<RowDataPacket[]>(
        'SELECT COUNT(*) as count FROM article WHERE owner_id = ? AND fakeid = ? AND create_time < ?',
        [ownerId, fakeid, createTime]
    );
    return rows[0].count > 0;
}

/**
 * 读取缓存中的指定时间之前的历史文章
 */
export async function getArticleCache(ownerId: string, fakeid: string, createTime: number): Promise<AppMsgExWithFakeID[]> {
    const rows = await query<ArticleRow[]>(
        'SELECT * FROM article WHERE owner_id = ? AND fakeid = ? AND create_time < ? ORDER BY create_time DESC',
        [ownerId, fakeid, createTime]
    );
    return rows.map(rowToArticle);
}

/**
 * 根据 URL 获取文章对象
 */
export async function getArticleByLink(ownerId: string, url: string): Promise<AppMsgExWithFakeID> {
    const rows = await query<ArticleRow[]>(
        'SELECT * FROM article WHERE owner_id = ? AND link = ? LIMIT 1',
        [ownerId, url]
    );
    if (rows.length === 0) {
        throw new Error(`Article(${url}) does not exist`);
    }
    return rowToArticle(rows[0]);
}

/**
 * 标记文章为已删除
 */
export async function articleDeleted(ownerId: string, url: string): Promise<void> {
    await execute(
        'UPDATE article SET is_deleted = 1 WHERE owner_id = ? AND link = ?',
        [ownerId, url]
    );
}

/**
 * 根据公众号ID获取所有文章
 */
export async function getArticlesByFakeid(ownerId: string, fakeid: string): Promise<AppMsgExWithFakeID[]> {
    const rows = await query<ArticleRow[]>(
        'SELECT * FROM article WHERE owner_id = ? AND fakeid = ? ORDER BY create_time DESC',
        [ownerId, fakeid]
    );
    return rows.map(rowToArticle);
}

/**
 * 获取单篇文章
 */
export async function getArticle(ownerId: string, id: string): Promise<AppMsgExWithFakeID | undefined> {
    const rows = await query<ArticleRow[]>(
        'SELECT * FROM article WHERE owner_id = ? AND id = ?',
        [ownerId, id]
    );
    if (rows.length === 0) return undefined;
    return rowToArticle(rows[0]);
}
