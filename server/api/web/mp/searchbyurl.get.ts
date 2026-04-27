import { searchAccountByArticleUrl } from '~/server/services/api/mp-service';

interface UrlQuery {
  url: string;
}

export default defineEventHandler(async event => {
  let { url } = getQuery<UrlQuery>(event);

  return searchAccountByArticleUrl(event, {
    url,
    authErrorMessage: '未登录或登录已过期，请重新扫码登录',
    searchErrorMessage: '搜索公众号接口失败，请重试',
  });
});
