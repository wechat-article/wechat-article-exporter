import TurndownService from 'turndown';
import { urlIsValidMpArticle } from '#shared/utils';
import { normalizeHtml, parseCgiDataNew } from '#shared/utils/html';
import { USER_AGENT } from '~/config';

/**
 * Enhanced download endpoint using Scrapling service for markdown+images.
 *
 * Query params:
 *   url     – WeChat article URL (required)
 *   format  – html | markdown | text | json | markdown-zip (default: html)
 *
 * `markdown-zip` format delegates to the Scrapling Python sidecar
 * and returns a ZIP containing `<title>.md` + `images/` folder.
 */

interface DownloadQuery {
  url: string;
  format: string;
}

// Scrapling service URL – can be set via env or defaults to localhost
const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL || 'http://localhost:8100';

export default defineEventHandler(async event => {
  const query = getQuery<DownloadQuery>(event);
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
  if (!['html', 'markdown', 'text', 'json', 'markdown-zip'].includes(format)) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '不支持的format，可选: html, markdown, text, json, markdown-zip',
      },
    };
  }

  // Fetch the raw HTML from WeChat
  const rawHtml = await fetch(url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
  }).then(res => res.text());

  // For markdown-zip: delegate to Scrapling service
  if (format === 'markdown-zip') {
    try {
      const scraplingResp = await fetch(`${SCRAPLING_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: rawHtml,
          download_images: true,
          output_format: 'zip',
        }),
      });

      if (!scraplingResp.ok) {
        const errorBody = await scraplingResp.text();
        return {
          base_resp: {
            ret: -2,
            err_msg: `Scrapling service error: ${errorBody}`,
          },
        };
      }

      // Stream the ZIP response back
      const zipBuffer = await scraplingResp.arrayBuffer();
      const contentDisposition = scraplingResp.headers.get('content-disposition') || 'attachment; filename="article.zip"';

      return new Response(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': contentDisposition,
        },
      });
    } catch (error: any) {
      return {
        base_resp: {
          ret: -3,
          err_msg: `Failed to connect to Scrapling service at ${SCRAPLING_URL}: ${error.message}`,
        },
      };
    }
  }

  // For markdown: try Scrapling first, fallback to basic conversion
  if (format === 'markdown') {
    try {
      const scraplingResp = await fetch(`${SCRAPLING_URL}/parse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: rawHtml,
          download_images: false,
          output_format: 'json',
        }),
      });

      if (scraplingResp.ok) {
        const data = await scraplingResp.json() as any;
        if (data.markdown) {
          return new Response(data.markdown, {
            status: 200,
            headers: {
              'Content-Type': 'text/markdown; charset=UTF-8',
            },
          });
        }
      }
    } catch {
      // Scrapling service unavailable, fallback to basic conversion
    }

    // Fallback: basic TurndownService conversion
    return new Response(new TurndownService().turndown(normalizeHtml(rawHtml, 'html')), {
      status: 200,
      headers: {
        'Content-Type': 'text/markdown; charset=UTF-8',
      },
    });
  }

  // Original formats
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
    case 'json':
      return await parseCgiDataNew(rawHtml);
    default:
      throw new Error(`Unknown format ${format}`);
  }
});
