interface AccountNameQuery {
  url: string;
}

import { resolveAccountNameFromArticleUrl } from '~/server/services/api/mp-service';

/**
 * 根据文章 url 获取公众号名称
 */
export default defineEventHandler(async event => {
  const { url } = getQuery<AccountNameQuery>(event);
  return resolveAccountNameFromArticleUrl(url);
});
