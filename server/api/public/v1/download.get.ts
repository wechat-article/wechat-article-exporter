import TurndownService from 'turndown';
import { normalizeHtml } from '#shared/utils/html';
import { USER_AGENT } from '~/config';
import { parseCgiDataNewOnServer } from '~/server/utils/wechat-cgi-data';
import {
  buildAllowedWechatDirectFetchUrl,
  createWechatDirectFetchBlockedBody,
  createWechatDirectFetchRequestInit,
  WECHAT_ARTICLE_PATH_PREFIXES,
  WECHAT_MP_HOST,
} from '~/server/utils/wechat-direct-fetch';

interface SearchBizQuery {
  url: string;
  format: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<SearchBizQuery>(event);
  if (!query.url) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url不能为空',
      },
    };
  }

  const url = decodeURIComponent(query.url.trim());
  const urlResult = buildAllowedWechatDirectFetchUrl(url, {
    allowedHosts: [WECHAT_MP_HOST],
    allowedPathPrefixes: WECHAT_ARTICLE_PATH_PREFIXES,
  });
  if (!urlResult.allowed) {
    return createWechatDirectFetchBlockedBody(urlResult.reason);
  }

  const format: string = (query.format || 'html').toLowerCase();
  if (!['html', 'markdown', 'text', 'json'].includes(format)) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '不支持的format',
      },
    };
  }

  const rawHtml = await fetch(
    urlResult.url,
    createWechatDirectFetchRequestInit({
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    }),
  ).then(res => res.text());

  switch (format) {
    case 'html':
      return new Response(normalizeHtml(rawHtml, 'html'), {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=UTF-8',
        },
      });
    case 'text':
      return new Response(normalizeHtml(rawHtml, 'text'), {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=UTF-8',
        },
      });
    case 'markdown':
      return new Response(new TurndownService().turndown(normalizeHtml(rawHtml, 'html')), {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=UTF-8',
        },
      });
    case 'json':
      return await parseCgiDataNewOnServer(rawHtml);
    default:
      throw new Error(`Unknown format ${format}`);
  }
});
