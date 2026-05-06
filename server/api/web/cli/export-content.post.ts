import { promises as fs } from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import TurndownService from 'turndown';
import { ARTICLE_LIST_PAGE_SIZE, USER_AGENT } from '~/config';
import { normalizeHtml, parseCgiDataNew } from '#shared/utils/html';
import { filterInvalidFilenameChars } from '#shared/utils/helpers';
import { getTokenFromStore } from '~/server/utils/CookieStore';
import { proxyMpRequest } from '~/server/utils/proxy-request';

type ExportFormat = 'html' | 'markdown' | 'text' | 'json';

interface ExportContentBody {
  account?: string;
  fakeid?: string;
  year?: number;
  format?: ExportFormat;
  filename?: string;
}

const extensions: Record<ExportFormat, string> = {
  html: 'html',
  markdown: 'md',
  text: 'txt',
  json: 'json',
};

function normalizeFilename(filename: string) {
  return filterInvalidFilenameChars(filename || 'untitled') || 'untitled';
}

function uniqueName(filename: string, extension: string, usedNames: Set<string>) {
  const base = normalizeFilename(filename);
  let name = `${base}.${extension}`;
  let index = 2;
  while (usedNames.has(name)) {
    name = `${base}-${index}.${extension}`;
    index++;
  }
  usedNames.add(name);
  return name;
}

async function resolveFakeid(event: any, account?: string, fakeid?: string) {
  if (fakeid) return fakeid;
  if (!account) {
    throw createError({ statusCode: 400, statusMessage: 'account or fakeid is required' });
  }

  const token = await getTokenFromStore(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'not logged in or auth-key expired' });
  }

  const resp = await proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/searchbiz',
    query: {
      action: 'search_biz',
      begin: 0,
      count: 20,
      query: account,
      token,
      lang: 'zh_CN',
      f: 'json',
      ajax: '1',
    },
    parseJson: true,
  });

  if (resp?.base_resp?.ret !== 0) {
    throw createError({ statusCode: 502, statusMessage: resp?.base_resp?.err_msg || 'search account failed' });
  }

  const matches = (resp.list || []).filter((item: any) => item.nickname === account || item.nickname?.includes(account));
  const matched = matches[0] || resp.list?.[0];
  if (!matched?.fakeid) {
    throw createError({ statusCode: 404, statusMessage: `account not found: ${account}` });
  }
  return matched.fakeid;
}

async function fetchArticles(event: any, fakeid: string, year: number) {
  const token = await getTokenFromStore(event);
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'not logged in or auth-key expired' });
  }

  const start = Math.floor(new Date(`${year}-01-01T00:00:00+08:00`).getTime() / 1000);
  const end = Math.floor(new Date(`${year + 1}-01-01T00:00:00+08:00`).getTime() / 1000);
  const articles: any[] = [];

  for (let begin = 0; begin < 10000; begin += ARTICLE_LIST_PAGE_SIZE) {
    const resp = await proxyMpRequest({
      event,
      method: 'GET',
      endpoint: 'https://mp.weixin.qq.com/cgi-bin/appmsgpublish',
      query: {
        sub: 'list',
        search_field: 'null',
        begin,
        count: ARTICLE_LIST_PAGE_SIZE,
        query: '',
        fakeid,
        type: '101_1',
        free_publish_type: 1,
        sub_action: 'list_ex',
        token,
        lang: 'zh_CN',
        f: 'json',
        ajax: 1,
      },
      parseJson: true,
    });

    if (resp?.base_resp?.ret !== 0) {
      throw createError({ statusCode: 502, statusMessage: resp?.base_resp?.err_msg || 'fetch article list failed' });
    }

    const publishPage = JSON.parse(resp.publish_page);
    const publishList = (publishPage.publish_list || []).filter((item: any) => !!item.publish_info);
    if (publishList.length === 0) break;

    const pageArticles = publishList.flatMap((item: any) => JSON.parse(item.publish_info).appmsgex || []);
    for (const article of pageArticles) {
      if (article.update_time >= start && article.update_time < end) {
        articles.push(article);
      }
    }

    const oldest = Math.min(...pageArticles.map((article: any) => article.update_time).filter(Boolean));
    if (Number.isFinite(oldest) && oldest < start) break;
  }

  return articles;
}

async function fetchArticleHtml(url: string) {
  const response = await fetch(url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
  });
  if (!response.ok) {
    throw new Error(`fetch ${url} failed: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function convertContent(rawHtml: string, format: ExportFormat) {
  if (format === 'html') return normalizeHtml(rawHtml, 'html');
  if (format === 'text') return normalizeHtml(rawHtml, 'text');
  if (format === 'markdown') return new TurndownService().turndown(normalizeHtml(rawHtml, 'html'));
  return JSON.stringify(await parseCgiDataNew(rawHtml), null, 2);
}

export default defineEventHandler(async event => {
  const body = await readBody<ExportContentBody>(event);
  const format = (body.format || 'html').toLowerCase() as ExportFormat;
  if (!['html', 'markdown', 'text', 'json'].includes(format)) {
    throw createError({ statusCode: 400, statusMessage: 'format must be html, markdown, text, or json' });
  }

  const year = Number(body.year || new Date().getFullYear());
  const fakeid = await resolveFakeid(event, body.account, body.fakeid);
  const articles = await fetchArticles(event, fakeid, year);

  if (articles.length === 0) {
    throw createError({ statusCode: 404, statusMessage: `no articles found for ${year}` });
  }

  const zip = new JSZip();
  const usedNames = new Set<string>();
  const failures: Array<{ title: string; url: string; error: string }> = [];

  for (const article of articles) {
    try {
      const rawHtml = await fetchArticleHtml(article.link);
      zip.file(uniqueName(article.title, extensions[format], usedNames), await convertContent(rawHtml, format));
    } catch (error) {
      failures.push({
        title: article.title,
        url: article.link,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  const dir = path.resolve(process.cwd(), '.data/exports');
  await fs.mkdir(dir, { recursive: true });
  const filename = body.filename || `${normalizeFilename(body.account || fakeid)}-${year}-${format}.zip`;
  const filepath = path.join(dir, filename);
  await fs.writeFile(filepath, zipBuffer);

  return {
    fakeid,
    year,
    format,
    total: articles.length,
    exported: usedNames.size,
    failed: failures.length,
    failures,
    filename,
    filepath,
    size: zipBuffer.length,
  };
});
