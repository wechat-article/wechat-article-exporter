import TurndownService from 'turndown';
import { urlIsValidMpArticle } from '#shared/utils';
import { normalizeHtml, parseCgiDataNew } from '#shared/utils/html';
import { USER_AGENT } from '~/config';
import { enforceRateLimit } from '~/server/utils/rate-limit';

interface SearchBizQuery {
  url: string;
  format: string;
}

export default defineEventHandler(async event => {
  // 分级限流（下载类）：游客 1 次/分钟（按 IP），会员 60 次/分钟（按 X-Api-Token）。
  // 放在最前面，使被限流的请求在 fetch/cheerio 解析之前返回 429，不消耗 CPU。
  await enforceRateLimit(event, 'download');

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
  if (!urlIsValidMpArticle(url)) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url不合法',
      },
    };
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

  const rawHtml = await fetch(url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
  }).then(res => res.text());

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
    case 'json': {
      // 内置沙箱：从 CF 运行时取 LOADER（Dynamic Workers）；无 LOADER 时（node/nuxt dev）html.ts 会用 new Function 兜底
      const loader = (event.context as any).cloudflare?.env?.LOADER;
      return await parseCgiDataNew(rawHtml, loader);
    }
    default:
      throw new Error(`Unknown format ${format}`);
  }
});
