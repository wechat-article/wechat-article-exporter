import { urlIsValidMpArticle } from '#shared/utils';
import { normalizeHtml, parseCgiDataNew } from '#shared/utils/html';
import { createTurndownService } from '#shared/utils/markdown';
import { USER_AGENT } from '~/config';
import { enforceRateLimit } from '~/server/utils/rate-limit';

interface SearchBizQuery {
  url: string;
  format: string;
}

export default defineEventHandler(async event => {
  // 分级限流（下载类）：游客 1 次/分钟（按 IP），会员 60 次/分钟（按 X-Api-Token）。
  // 放在最前面，使被限流的请求在 fetch/cheerio 解析之前返回 429，不消耗 CPU。
  const { isMember, tokenStatus } = await enforceRateLimit(event, 'download');

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

  // 会员专属格式：markdown / text / json 仅限会员（携带有效 X-Api-Token），游客只能取 html。
  // 仅在会员/限速层开启时生效（fork 私有部署 membership.enabled=false 时不限制，全部格式开放）。
  const membershipEnabled = useRuntimeConfig(event).public.membership.enabled;
  const MEMBER_ONLY_FORMATS = ['markdown', 'text', 'json'];
  if (membershipEnabled && !isMember && MEMBER_ONLY_FORMATS.includes(format)) {
    const hint =
      tokenStatus === 'expired' ? '会员令牌已过期，续费后恢复；' : tokenStatus === 'invalid' ? '会员令牌无效；' : '';
    throw createError({
      statusCode: 403,
      statusMessage: `${hint}${format} 格式仅限会员（请在请求头携带有效 X-Api-Token），游客仅支持 html 格式`,
    });
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
      return new Response(createTurndownService().turndown(normalizeHtml(rawHtml, 'html')).trim(), {
        status: 200,
        headers: {
          'Content-Type': 'text/markdown; charset=UTF-8',
        },
      });
    case 'json': {
      // 用 QuickJS-WASM 沙箱在主 Worker 内执行 cgi 脚本，取回 window.cgiDataNew（node / CF workerd 通用）
      return await parseCgiDataNew(rawHtml);
    }
    default:
      throw new Error(`Unknown format ${format}`);
  }
});
