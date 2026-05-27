/**
 * Batch download endpoint using Scrapling service.
 *
 * POST /api/public/v1/batch-download
 *
 * Body:
 *   urls      – array of WeChat article URLs (required, max 50)
 *   format    – markdown-zip | markdown-json (default: markdown-zip)
 *   output_dir – directory to save files (optional, for server-side output)
 *
 * This endpoint fetches each article HTML, sends to Scrapling for parsing,
 * and returns a single ZIP containing all articles with images.
 */

import { urlIsValidMpArticle } from '#shared/utils';
import { USER_AGENT } from '~/config';

const SCRAPLING_URL = process.env.SCRAPLING_SERVICE_URL || 'http://localhost:8100';

export default defineEventHandler(async event => {
  const body = await readBody(event);

  if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'urls数组不能为空',
      },
    };
  }

  if (body.urls.length > 50) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '每次最多处理50篇文章',
      },
    };
  }

  const format: string = (body.format || 'markdown-zip').toLowerCase();
  const outputDir: string = body.output_dir || '/tmp/wechat-articles';
  const results: any[] = [];
  const errors: any[] = [];

  for (let i = 0; i < body.urls.length; i++) {
    const url = decodeURIComponent(body.urls[i].trim());

    if (!urlIsValidMpArticle(url)) {
      errors.push({ url, error: 'url不合法' });
      continue;
    }

    try {
      // 1. Fetch article HTML with proper headers to avoid WeChat anti-bot
      const rawHtml = await fetch(url, {
        headers: {
          Referer: 'https://mp.weixin.qq.com/',
          Origin: 'https://mp.weixin.qq.com',
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        },
        redirect: 'follow',
      }).then(res => res.text());

      // 2. Send to Scrapling service for parsing and saving to disk
      const scraplingResp = await fetch(`${SCRAPLING_URL}/parse-to-disk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: rawHtml,
          output_dir: outputDir,
        }),
      });

      if (scraplingResp.ok) {
        const data = await scraplingResp.json() as any;
        results.push({
          url,
          title: data.title,
          path: data.path,
          markdown_file: data.markdown_file,
          image_count: data.image_count,
          total_images: data.total_images,
        });
      } else {
        const errorText = await scraplingResp.text();
        errors.push({ url, error: `Scrapling error: ${errorText}` });
      }
    } catch (error: any) {
      errors.push({ url, error: error.message });
    }
  }

  return {
    base_resp: { ret: 0 },
    total: body.urls.length,
    success: results.length,
    failed: errors.length,
    results,
    errors,
    output_dir: outputDir,
  };
});
