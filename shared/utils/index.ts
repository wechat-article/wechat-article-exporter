/**
 * url是否是合法的微信公众号文章url
 * @param url
 */
export function urlIsValidMpArticle(url: string) {
  try {
    return new URL(url).hostname === 'mp.weixin.qq.com';
  } catch (e) {
    return false;
  }
}

/**
 * 是否应跳过抓取的微信公众号链接
 * @param url
 */
export function shouldSkipMpArticleUrl(url: string) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname === 'mp.weixin.qq.com'
      && parsedUrl.pathname === '/mp/appmsg/show'
      && parsedUrl.searchParams.has('__biz');
  } catch (e) {
    return false;
  }
}
