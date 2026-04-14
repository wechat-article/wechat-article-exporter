import type { AppMsgEx } from '~/types/types';

type ArticleRecordLike = Partial<Pick<
  AppMsgEx,
  'cover' | 'cover_img' | 'pic_cdn_url_235_1' | 'pic_cdn_url_16_9' | 'pic_cdn_url_3_4' | 'pic_cdn_url_1_1' | 'digest' | 'is_deleted'
>>;

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function resolveArticleCover(article: ArticleRecordLike): string | null {
  return [
    article.cover,
    article.cover_img,
    article.pic_cdn_url_235_1,
    article.pic_cdn_url_16_9,
    article.pic_cdn_url_3_4,
    article.pic_cdn_url_1_1,
  ]
    .map(normalizeText)
    .find((value): value is string => Boolean(value)) || null;
}

export function resolveArticleDigest(article: ArticleRecordLike): string | null {
  return normalizeText(article.digest);
}

export function resolveArticleDeleted(article: ArticleRecordLike): boolean {
  return article.is_deleted === true;
}