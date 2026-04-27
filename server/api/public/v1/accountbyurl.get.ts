import { searchAccountByArticleUrl } from '~/server/services/api/mp-service';

interface UrlQuery {
  url: string;
}

export default defineEventHandler(async event => {
  const { url } = getQuery<UrlQuery>(event);

  return searchAccountByArticleUrl(event, {
    url,
    authErrorMessage: '认证信息无效',
    searchErrorMessage: '搜索公众号接口失败，请稍后重试',
  });
});
