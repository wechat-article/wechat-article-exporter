#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

const DEFAULT_SERVER = 'http://127.0.0.1:3000';

function printHelp() {
  console.log(`wechat-exporter

Usage:
  wechat-exporter <command> [options]

Common commands:
  login                                     Login by QR code scan
  auth-key                                  Print detected auth key
  me                                        Show current logged-in MP account
  search-account --keyword <name>           Search official accounts
  account-by-url --url <article-url>        Resolve an official account from an article URL
  articles --account <name> [options]       List articles from an official account
  articles --fakeid <fakeid> [options]      List articles from an official account fakeid
  export --format <format> --year 2026      Export a year's articles to a zip
  export-word --account <name> --year 2026  Export a year's articles to a Word zip
  export-pdf --account <name> --year 2026   Export a year's articles to a PDF zip
  download --url <article-url> [options]    Download one article as html/markdown/text/json
  public-account --keyword <name>           Call public account search API
  public-articles --fakeid <fakeid>         Call public article list API
  album --fakeid <biz> --album-id <id>      Fetch album articles
  comments --url <article-url>              Fetch comments when URL contains required keys
  current-ip                                Show outbound IP
  proxy-metrics                             Show worker proxy metrics
  blocked-ips                               Show blocked IP list
  logout                                    Logout current auth key

Power-user command:
  api GET /api/web/mp/info
  api POST /api/web/cli/export-word --body '{"account":"公众号","year":2026}'

Global options:
  --server <url>      Local server URL. Default: ${DEFAULT_SERVER}
  --auth-key <key>    Auth key from login cookie storage
  --data-dir <dir>    Data directory used to auto-detect auth-key. Default: .data
  --output <file>     Write response body to a file
  --qrcode <file>     QR code image path for login. Default: .data/login-qrcode.jpg
  --pretty            Pretty-print JSON. Default for terminal JSON output
  --raw               Print raw response body
  -h, --help          Show help

Command options:
  --keyword <text>    Search keyword
  --account <name>    Official account nickname
  --fakeid <fakeid>   Official account fakeid / __biz
  --year <year>       Publish year filter
  --begin <n>         Begin offset. Default: 0
  --size <n>          Page size. Default: 5
  --all               Fetch article pages until exhausted
  --format <format>   html, markdown, text, or json. Default: html
  --filename <name>   Output zip filename for export-word
  --url <url>         WeChat article URL
  --album-id <id>     Album ID
  --query k=v         Add query parameter. Can be repeated
  --body <json>       JSON body for POST/PUT/PATCH api calls

Examples:
  wechat-exporter login
  wechat-exporter me
  wechat-exporter search-account --keyword 华普亿方数智就创业
  wechat-exporter articles --account 华普亿方数智就创业 --year 2026 --all
  wechat-exporter export --account 华普亿方数智就创业 --year 2026 --format markdown
  wechat-exporter export-word --account 华普亿方数智就创业 --year 2026
  wechat-exporter export-pdf --account 华普亿方数智就创业 --year 2026
  wechat-exporter download --url 'https://mp.weixin.qq.com/s/...' --format markdown --output article.md
  node cli/wechat-exporter.mjs api GET /api/web/worker/overview-metrics
`);
}

function parseArgs(argv) {
  const args = { _: [], query: [] };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('-')) {
      args._.push(arg);
      continue;
    }
    const key = arg.replace(/^-+/, '');
    if (key === 'h' || key === 'help') {
      args.help = true;
      continue;
    }
    const value = argv[i + 1];
    if (!value || value.startsWith('-')) {
      args[key] = true;
      continue;
    }
    if (key === 'query') {
      args.query.push(value);
    } else {
      args[key] = value;
    }
    i++;
  }
  return args;
}

function serverUrl(args) {
  return String(args.server || DEFAULT_SERVER).replace(/\/$/, '');
}

async function detectAuthKey(dataDir) {
  const cookieDir = path.resolve(dataDir, 'kv/cookie');
  const names = await fs.readdir(cookieDir).catch(() => []);
  const candidates = names.filter(name => !name.startsWith('.')).sort();
  return candidates[0] || null;
}

async function authKey(args, required = true) {
  if (args['auth-key']) return String(args['auth-key']);
  const detected = await detectAuthKey(String(args['data-dir'] || '.data'));
  if (!detected && required) {
    throw new Error(`Missing --auth-key and no auth key found under ${path.resolve(String(args['data-dir'] || '.data'), 'kv/cookie')}`);
  }
  return detected;
}

function appendQuery(url, values = {}) {
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

function parseQueryPairs(pairs = []) {
  const values = {};
  for (const pair of pairs) {
    const index = pair.indexOf('=');
    if (index === -1) {
      values[pair] = '';
    } else {
      values[pair.slice(0, index)] = pair.slice(index + 1);
    }
  }
  return values;
}

async function request(args, method, route, { query, body, authRequired = true, raw = false } = {}) {
  const url = new URL(route.startsWith('http') ? route : `${serverUrl(args)}${route}`);
  appendQuery(url, query);
  const key = await authKey(args, authRequired);
  const response = await fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(key ? { 'X-Auth-Key': key } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
  if (raw) return text;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json') || looksJson(text)) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return text;
}

async function requestRaw(args, method, route, { query, body, cookie } = {}) {
  const url = new URL(route.startsWith('http') ? route : `${serverUrl(args)}${route}`);
  appendQuery(url, query);
  return fetch(url, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function getSetCookies(headers) {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }
  const value = headers.get('set-cookie');
  return value ? splitSetCookie(value) : [];
}

function splitSetCookie(value) {
  const result = [];
  let start = 0;
  let inExpires = false;
  for (let i = 0; i < value.length; i++) {
    const rest = value.slice(i).toLowerCase();
    if (rest.startsWith('expires=')) inExpires = true;
    if (inExpires && value[i] === ';') inExpires = false;
    if (!inExpires && value[i] === ',') {
      result.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  result.push(value.slice(start).trim());
  return result.filter(Boolean);
}

function mergeCookies(cookieJar, setCookies) {
  for (const cookie of setCookies) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (!name) continue;
    if (value === 'EXPIRED') {
      delete cookieJar[name];
    } else {
      cookieJar[name] = value;
    }
  }
}

function cookieHeader(cookieJar) {
  return Object.entries(cookieJar)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function authKeyFromSetCookies(setCookies) {
  for (const cookie of setCookies) {
    const [pair] = cookie.split(';');
    const index = pair.indexOf('=');
    if (index === -1) continue;
    if (pair.slice(0, index).trim() === 'auth-key') {
      return pair.slice(index + 1).trim();
    }
  }
  return null;
}

function looksJson(text) {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

async function output(args, value) {
  const text = typeof value === 'string'
    ? value
    : (args.raw ? JSON.stringify(value) : JSON.stringify(value, null, 2));
  if (args.output) {
    await fs.writeFile(path.resolve(String(args.output)), text);
    console.log(path.resolve(String(args.output)));
  } else {
    console.log(text);
  }
}

function requireArg(args, name) {
  const value = args[name];
  if (!value) throw new Error(`Missing --${name}`);
  return String(value);
}

async function resolveFakeid(args) {
  if (args.fakeid) return String(args.fakeid);
  const keyword = requireArg(args, 'account');
  const result = await request(args, 'GET', '/api/web/mp/searchbiz', {
    query: { keyword, size: args.size || 20 },
  });
  const matches = (result.list || []).filter(item => item.nickname === keyword || item.nickname?.includes(keyword));
  const matched = matches[0] || result.list?.[0];
  if (!matched?.fakeid) throw new Error(`Account not found: ${keyword}`);
  return matched.fakeid;
}

function parsePublishArticles(resp) {
  if (resp?.base_resp?.ret !== 0) {
    throw new Error(resp?.base_resp?.err_msg || 'request failed');
  }
  if (!resp.publish_page) return [];
  const publishPage = JSON.parse(resp.publish_page);
  return (publishPage.publish_list || [])
    .filter(item => item.publish_info)
    .flatMap(item => JSON.parse(item.publish_info).appmsgex || []);
}

function filterByYear(articles, year) {
  if (!year) return articles;
  const start = Math.floor(new Date(`${year}-01-01T00:00:00+08:00`).getTime() / 1000);
  const end = Math.floor(new Date(`${Number(year) + 1}-01-01T00:00:00+08:00`).getTime() / 1000);
  return articles.filter(article => article.update_time >= start && article.update_time < end);
}

function simplifyArticle(article) {
  return {
    title: article.title,
    update_time: article.update_time,
    url: article.link,
    digest: article.digest,
    cover: article.cover,
  };
}

async function commandAuthKey(args) {
  console.log(await authKey(args));
}

async function readJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(text || `${response.status} ${response.statusText}`);
  }
}

async function commandLogin(args) {
  const cookieJar = {};
  const sid = `${Date.now()}${Math.floor(Math.random() * 100)}`;
  const qrcodePath = path.resolve(String(args.qrcode || '.data/login-qrcode.jpg'));

  const startResp = await requestRaw(args, 'POST', `/api/web/login/session/${sid}`);
  mergeCookies(cookieJar, getSetCookies(startResp.headers));
  const startJson = await readJsonResponse(startResp);
  if (!startResp.ok || startJson?.base_resp?.ret !== 0) {
    throw new Error(startJson?.base_resp?.err_msg || 'start login failed');
  }

  const qrResp = await requestRaw(args, 'GET', '/api/web/login/getqrcode', {
    query: { rnd: Math.random() },
    cookie: cookieHeader(cookieJar),
  });
  mergeCookies(cookieJar, getSetCookies(qrResp.headers));
  if (!qrResp.ok) {
    throw new Error(`get qrcode failed: ${qrResp.status} ${qrResp.statusText}`);
  }
  await fs.mkdir(path.dirname(qrcodePath), { recursive: true });
  await fs.writeFile(qrcodePath, Buffer.from(await qrResp.arrayBuffer()));

  console.error(`QR code saved: ${qrcodePath}`);
  console.error('Scan it in WeChat, then confirm login on your phone...');

  const deadline = Date.now() + Number(args.timeout || 120) * 1000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, Number(args.interval || 2) * 1000));
    const scanResp = await requestRaw(args, 'GET', '/api/web/login/scan', {
      cookie: cookieHeader(cookieJar),
    });
    mergeCookies(cookieJar, getSetCookies(scanResp.headers));
    const scanJson = await readJsonResponse(scanResp);
    if (scanJson?.base_resp?.ret !== 0) continue;

    if (scanJson.status === 1) {
      const loginResp = await requestRaw(args, 'POST', '/api/web/login/bizlogin', {
        cookie: cookieHeader(cookieJar),
      });
      const setCookies = getSetCookies(loginResp.headers);
      mergeCookies(cookieJar, setCookies);
      const loginJson = await readJsonResponse(loginResp);
      if (!loginResp.ok || loginJson.err) {
        throw new Error(loginJson.err || 'biz login failed');
      }
      const key = authKeyFromSetCookies(setCookies);
      await output(args, { ...loginJson, auth_key: key });
      return;
    }

    if (scanJson.status === 4 || scanJson.status === 6) {
      console.error('Scanned. Waiting for confirmation...');
    } else if (scanJson.status === 2 || scanJson.status === 3) {
      throw new Error('QR code expired, run login again');
    } else if (scanJson.status === 5) {
      throw new Error('This account has no bound email and cannot scan-login');
    }
  }

  throw new Error('Login timed out');
}

async function commandGet(args, route, query = {}, authRequired = true) {
  await output(args, await request(args, 'GET', route, { query, authRequired, raw: args.raw }));
}

async function commandSearchAccount(args) {
  await commandGet(args, '/api/web/mp/searchbiz', {
    keyword: requireArg(args, 'keyword'),
    begin: args.begin || 0,
    size: args.size || 5,
  });
}

async function commandAccountByUrl(args) {
  await commandGet(args, '/api/web/mp/searchbyurl', { url: requireArg(args, 'url') });
}

async function commandArticles(args) {
  const fakeid = await resolveFakeid(args);
  const size = Number(args.size || 5);
  const begin = Number(args.begin || 0);
  const all = Boolean(args.all);
  const year = args.year ? Number(args.year) : undefined;
  const rows = [];

  for (let offset = begin; offset < 10000; offset += size) {
    const resp = await request(args, 'GET', '/api/web/mp/appmsgpublish', {
      query: {
        id: fakeid,
        keyword: args.keyword || '',
        begin: offset,
        size,
      },
    });
    const pageRows = parsePublishArticles(resp);
    rows.push(...filterByYear(pageRows, year));
    if (!all || pageRows.length < size) break;
    if (year) {
      const oldest = Math.min(...pageRows.map(article => article.update_time).filter(Boolean));
      const start = Math.floor(new Date(`${year}-01-01T00:00:00+08:00`).getTime() / 1000);
      if (Number.isFinite(oldest) && oldest < start) break;
    }
  }

  await output(args, rows.map(simplifyArticle));
}

async function commandExportWord(args) {
  const account = args.account ? String(args.account) : undefined;
  const fakeid = args.fakeid ? String(args.fakeid) : undefined;
  if (!account && !fakeid) throw new Error('Missing --account or --fakeid');
  const year = Number(args.year || new Date().getFullYear());
  console.error(`Exporting ${year} articles...`);
  await output(args, await request(args, 'POST', '/api/web/cli/export-word', {
    body: { account, fakeid, year, filename: args.filename ? String(args.filename) : undefined },
  }));
}

async function commandExportContent(args) {
  const account = args.account ? String(args.account) : undefined;
  const fakeid = args.fakeid ? String(args.fakeid) : undefined;
  if (!account && !fakeid) throw new Error('Missing --account or --fakeid');
  const year = Number(args.year || new Date().getFullYear());
  const format = String(args.format || 'html').toLowerCase();
  console.error(`Exporting ${year} articles to ${format}...`);
  await output(args, await request(args, 'POST', '/api/web/cli/export-content', {
    body: { account, fakeid, year, format, filename: args.filename ? String(args.filename) : undefined },
  }));
}

async function commandExportPdf(args) {
  const account = args.account ? String(args.account) : undefined;
  const fakeid = args.fakeid ? String(args.fakeid) : undefined;
  if (!account && !fakeid) throw new Error('Missing --account or --fakeid');
  const year = Number(args.year || new Date().getFullYear());
  console.error(`Exporting ${year} articles to PDF...`);
  await output(args, await request(args, 'POST', '/api/web/cli/export-pdf', {
    body: { account, fakeid, year, filename: args.filename ? String(args.filename) : undefined },
  }));
}

async function commandDownload(args) {
  await commandGet(args, '/api/public/v1/download', {
    url: requireArg(args, 'url'),
    format: args.format || 'html',
  }, false);
}

async function commandPublicAccount(args) {
  await commandGet(args, '/api/public/v1/account', {
    keyword: requireArg(args, 'keyword'),
    begin: args.begin || 0,
    size: args.size || 5,
  });
}

async function commandPublicArticles(args) {
  await commandGet(args, '/api/public/v1/article', {
    fakeid: requireArg(args, 'fakeid'),
    keyword: args.keyword || '',
    begin: args.begin || 0,
    size: args.size || 5,
  });
}

async function commandAlbum(args) {
  await commandGet(args, '/api/web/misc/appmsgalbum', {
    fakeid: requireArg(args, 'fakeid'),
    album_id: requireArg(args, 'album-id'),
    is_reverse: args.reverse ? '1' : '0',
    count: args.size || args.count || 20,
    begin_msgid: args['begin-msgid'],
    begin_itemidx: args['begin-itemidx'],
  }, false);
}

function queryFromArticleUrl(articleUrl) {
  const url = new URL(articleUrl);
  return {
    __biz: url.searchParams.get('__biz'),
    comment_id: url.searchParams.get('comment_id'),
    key: url.searchParams.get('key'),
    uin: url.searchParams.get('uin'),
    pass_ticket: url.searchParams.get('pass_ticket'),
  };
}

async function commandComments(args) {
  const params = args.url ? queryFromArticleUrl(String(args.url)) : {
    __biz: args.fakeid || args.__biz,
    comment_id: args['comment-id'],
    key: args.key,
    uin: args.uin,
    pass_ticket: args['pass-ticket'],
  };
  for (const name of ['__biz', 'comment_id', 'key', 'uin', 'pass_ticket']) {
    if (!params[name]) throw new Error(`Missing ${name}; provide a rich article URL or explicit comment parameters`);
  }
  await commandGet(args, '/api/web/misc/comment', params, false);
}

async function commandApi(args) {
  const method = String(args._[1] || 'GET').toUpperCase();
  const route = args._[2];
  if (!route) throw new Error('Usage: api METHOD /path [--query k=v] [--body json]');
  const body = args.body ? JSON.parse(String(args.body)) : undefined;
  await output(args, await request(args, method, route, {
    query: parseQueryPairs(args.query),
    body,
    authRequired: !args['no-auth'],
    raw: args.raw,
  }));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];
  if (args.help || !command) {
    printHelp();
    return;
  }

  switch (command) {
    case 'login':
      return commandLogin(args);
    case 'auth-key':
      return commandAuthKey(args);
    case 'me':
      return commandGet(args, '/api/web/mp/info');
    case 'search-account':
      return commandSearchAccount(args);
    case 'account-by-url':
      return commandAccountByUrl(args);
    case 'articles':
      return commandArticles(args);
    case 'export':
      return commandExportContent(args);
    case 'export-word':
      return commandExportWord(args);
    case 'export-pdf':
      return commandExportPdf(args);
    case 'download':
      return commandDownload(args);
    case 'public-account':
      return commandPublicAccount(args);
    case 'public-articles':
      return commandPublicArticles(args);
    case 'album':
      return commandAlbum(args);
    case 'comments':
      return commandComments(args);
    case 'current-ip':
      return commandGet(args, '/api/web/misc/current-ip', {}, false);
    case 'proxy-metrics':
      return commandGet(args, '/api/web/worker/overview-metrics', {}, false);
    case 'blocked-ips':
      return commandGet(args, '/api/web/worker/blocked-ip-list', {}, false);
    case 'logout':
      return commandGet(args, '/api/web/mp/logout');
    case 'api':
      return commandApi(args);
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
