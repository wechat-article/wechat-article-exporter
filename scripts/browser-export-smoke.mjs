#!/usr/bin/env node
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const SUMMARY_ENRICHMENT_ENABLED = process.env.WCPT_EXPORT_SUMMARY_ENRICHMENT === '1';
const OUTPUT_DIR_NAME = `browser-export-smoke-20260704${SUMMARY_ENRICHMENT_ENABLED ? '-json-summary' : ''}`;
const OUTPUT_DIR = path.join(ROOT, `tmp/outputs/${OUTPUT_DIR_NAME}`);
const DOWNLOAD_DIR = path.join(OUTPUT_DIR, 'downloads');
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, 'dashboard-article.png');
const PORT = Number(process.env.WCPT_SMOKE_PORT || 41931);
const HOST = '127.0.0.1';
const BASE_URL = process.env.WCPT_SMOKE_BASE_URL || `http://${HOST}:${PORT}`;
const START_SERVER = !process.env.WCPT_SMOKE_BASE_URL;
const PLAYWRIGHT_MODULE_DIR = findPlaywrightModuleDir();
const requireFromRoot = createRequire(path.join(ROOT, 'package.json'));
const JSZip = requireFromRoot('jszip');
const SUMMARY_ENRICHMENT_STORAGE_KEY = 'wcpt.summary_enrichment.accepted.v1';
const SUMMARY_ENRICHMENT_REVIEWED_AT = '2026-07-04T12:00:00.000Z';

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(DOWNLOAD_DIR, { recursive: true });

const { chromium } = loadPlaywright();

const smokeArticle = {
  fakeid: 'WCPT_SMOKE_FAKEID',
  aid: 'WCPT_SMOKE_AID_001',
  link: 'https://mp.weixin.qq.com/s/wcpt-local-browser-export-smoke',
  title: 'WCPT Browser Export Smoke',
  digest: 'Local browser export smoke article',
  create_time: 1_774_972_800,
  update_time: 1_774_972_860,
};

const smokeHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${smokeArticle.title}</title>
  <script type="text/javascript" h5only>
    window.cgiDataNew = {
      link: '${smokeArticle.link}',
      item_show_type: 0,
      title: '${smokeArticle.title}',
      author: 'Codex',
      nick_name: 'WCPT Smoke Account',
      create_time: '2026-07-04',
      ip_wording: { province_name: 'Local' },
      round_head_img: '',
      is_pay_subscribe: 0,
      content_noencode: '<section><p>Local browser export smoke content.</p><p>Markdown, DOCX, JSON, Excel, and HTML ZIP should all contain this article title.</p></section>',
      text_page_info: { is_user_title: 1, content_noencode: 'Local text content' },
      picture_page_info_list: [],
      pay_subscribe_info: {}
    };
  </script>
</head>
<body>
  <div id="js_article">
    <h1 id="activity-name">${smokeArticle.title}</h1>
    <div id="meta_content"><span id="js_name">WCPT Smoke Account</span><em id="publish_time"></em></div>
    <div id="js_content" style="visibility:hidden">
      <p>Local browser export smoke content.</p>
      <p>Markdown, DOCX, JSON, Excel, and HTML ZIP should all contain this article title.</p>
    </div>
    <div id="js_article_bottom_bar"><div class="interaction_bar"></div></div>
  </div>
</body>
</html>`;

let serverProcess = null;
let browser = null;

try {
  if (START_SERVER) {
    serverProcess = await startServer();
  } else {
    await waitForHttp(`${BASE_URL}/dashboard/article`);
  }

  browser = await launchBrowser();
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => {
    requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
  });

  const settingsResponse = await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle' });
  await seedIndexedDb(page);
  const articleResponse = await page.goto(`${BASE_URL}/dashboard/article`, { waitUntil: 'networkidle' });

  await selectSmokeAccount(page);
  await selectFirstGridRow(page);
  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

  const downloads = [];
  downloads.push(await exportByMenu(page, 'HTML', 'zip'));
  downloads.push(await exportByMenu(page, 'Markdown', 'zip'));
  downloads.push(await exportByMenu(page, 'Word', 'zip'));
  downloads.push(await exportByMenu(page, 'JSON', 'json'));
  downloads.push(await exportByMenu(page, 'Excel', 'xlsx'));

  const externalRequests = requests.filter(request => {
    const url = new URL(request.url);
    return url.origin !== BASE_URL;
  });
  const docxVendorRequests = requests.filter(request => request.url.includes('/vendors/html-docx-js@0.3.1/html-docx.js'));
  const summary = {
    baseUrl: BASE_URL,
    playwrightModuleDir: PLAYWRIGHT_MODULE_DIR,
    browserMode: process.env.PLAYWRIGHT_CHANNEL || 'chrome-with-chromium-fallback',
    seededArticle: {
      fakeid: smokeArticle.fakeid,
      aid: smokeArticle.aid,
      link: smokeArticle.link,
      title: smokeArticle.title,
    },
    cspHeaders: {
      settings: getCspHeader(settingsResponse),
      article: getCspHeader(articleResponse),
    },
    summaryEnrichmentEnabled: SUMMARY_ENRICHMENT_ENABLED,
    downloads,
    docxVendorRequests: docxVendorRequests.map(request => request.url),
    externalRequests,
    screenshot: path.relative(ROOT, SCREENSHOT_PATH),
    provider_call: false,
    production_changed: false,
  };

  assertDownloads(summary.downloads);
  assertCspHeaders(summary.cspHeaders);
  if (docxVendorRequests.length !== 1) {
    throw new Error(`Expected one DOCX vendor request, got ${docxVendorRequests.length}`);
  }
  if (externalRequests.length > 0) {
    throw new Error(`Unexpected external requests: ${externalRequests.map(request => request.url).join(', ')}`);
  }

  writeFileSync(RESULT_PATH, `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
  console.log('browser_export_smoke=pass');
} finally {
  if (browser) {
    await browser.close();
  }
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await delay(500);
  }
}

function findPlaywrightModuleDir() {
  const explicit = process.env.PLAYWRIGHT_MODULE_DIR;
  if (explicit && existsSync(path.join(explicit, 'playwright/package.json'))) {
    return explicit;
  }

  const localNodeModules = path.join(ROOT, 'node_modules');
  if (existsSync(path.join(localNodeModules, 'playwright/package.json'))) {
    return localNodeModules;
  }

  const npxRoot = path.join(homedir(), '.npm/_npx');
  if (existsSync(npxRoot)) {
    for (const entry of readdirSync(npxRoot)) {
      const nodeModules = path.join(npxRoot, entry, 'node_modules');
      if (existsSync(path.join(nodeModules, 'playwright/package.json'))) {
        return nodeModules;
      }
    }
  }

  throw new Error('Playwright package not found. Run the Playwright CLI wrapper once, or set PLAYWRIGHT_MODULE_DIR.');
}

function loadPlaywright() {
  const requireFromPlaywright = createRequire(path.join(PLAYWRIGHT_MODULE_DIR, 'noop.js'));
  return requireFromPlaywright('playwright');
}

async function startServer() {
  const indexPath = path.join(ROOT, '.output/server/index.mjs');
  if (!existsSync(indexPath)) {
    throw new Error('.output/server/index.mjs not found. Run yarn build first.');
  }

  const child = spawn(process.execPath, [indexPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      HOST,
      PORT: String(PORT),
      NITRO_KV_DRIVER: 'memory',
      NUXT_OPEN_API_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logPath = path.join(OUTPUT_DIR, 'server.log');
  child.stdout.on('data', chunk => appendLog(logPath, chunk));
  child.stderr.on('data', chunk => appendLog(logPath, chunk));
  await waitForHttp(`${BASE_URL}/dashboard/article`);
  return child;
}

function appendLog(file, chunk) {
  writeFileSync(file, chunk, { flag: 'a' });
}

function getCspHeader(response) {
  return response?.headers()['content-security-policy'] || '';
}

async function waitForHttp(url) {
  const deadline = Date.now() + 30_000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      lastStatus = response.status;
      if (response.status < 500) {
        return;
      }
    } catch {
      // Server not ready yet.
    }
    await delay(500);
  }
  throw new Error(`Timed out waiting for ${url}; lastStatus=${lastStatus}`);
}

async function launchBrowser() {
  try {
    return await chromium.launch({
      channel: process.env.PLAYWRIGHT_CHANNEL || 'chrome',
      headless: true,
    });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function seedIndexedDb(page) {
  await page.evaluate(
    async ({ article, html, summaryEnrichmentEnabled, summaryStorageKey, summaryReviewedAt }) => {
      const dbName = 'exporter.wxdown.online';

      function openDb() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(dbName, 3);
          request.onupgradeneeded = () => {
            const db = request.result;
            ensureStore(db, 'api', { autoIncrement: true }, ['name', 'account', 'call_time']);
            ensureStore(db, 'article', {}, ['fakeid', 'create_time', 'link']);
            ensureStore(db, 'asset', { keyPath: 'url' }, ['fakeid']);
            ensureStore(db, 'comment', { keyPath: 'url' }, ['fakeid']);
            ensureStore(db, 'comment_reply', {}, ['url', 'contentID', 'fakeid']);
            ensureStore(db, 'debug', { keyPath: 'url' }, ['fakeid']);
            ensureStore(db, 'html', { keyPath: 'url' }, ['fakeid']);
            ensureStore(db, 'info', { keyPath: 'fakeid' }, []);
            ensureStore(db, 'metadata', { keyPath: 'url' }, ['fakeid']);
            ensureStore(db, 'resource', { keyPath: 'url' }, ['fakeid']);
            ensureStore(db, 'resource-map', { keyPath: 'url' }, ['fakeid']);
          };
          request.onerror = () => reject(request.error);
          request.onsuccess = () => resolve(request.result);
        });
      }

      function ensureStore(db, name, options, indexes) {
        const store = db.objectStoreNames.contains(name) ? null : db.createObjectStore(name, options);
        if (!store) return;
        for (const index of indexes) {
          store.createIndex(index, index);
        }
      }

      const db = await openDb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(['info', 'article', 'html', 'metadata', 'resource-map'], 'readwrite');
        tx.objectStore('info').put({
          fakeid: article.fakeid,
          completed: true,
          count: 1,
          articles: 1,
          nickname: 'WCPT Smoke Account',
          round_head_img: '',
          total_count: 1,
          create_time: article.create_time,
          update_time: article.update_time,
          last_update_time: article.update_time,
        });
        tx.objectStore('article').put(
          {
            ...article,
            album_id: '',
            appmsg_album_infos: [],
            appmsgid: 1,
            author_name: 'Codex',
            ban_flag: 0,
            checking: 0,
            copyright_stat: 1,
            copyright_type: 1,
            cover: '',
            cover_img: '',
            create_time: article.create_time,
            has_red_packet_cover: 0,
            is_deleted: false,
            is_pay_subscribe: 0,
            wecoin_count: 0,
            item_show_type: 0,
            itemidx: 1,
            media_duration: '',
            mediaapi_publish_status: 0,
            pic_cdn_url_1_1: '',
            pic_cdn_url_3_4: '',
            pic_cdn_url_16_9: '',
            pic_cdn_url_235_1: '',
            _status: '正常',
          },
          `${article.fakeid}:${article.aid}`
        );
        tx.objectStore('html').put({
          fakeid: article.fakeid,
          url: article.link,
          title: article.title,
          commentID: null,
          file: new Blob([html], { type: 'text/html;charset=utf-8' }),
        });
        tx.objectStore('metadata').put({
          fakeid: article.fakeid,
          url: article.link,
          title: article.title,
          readNum: 123,
          oldLikeNum: 45,
          shareNum: 6,
          likeNum: 7,
          commentNum: 0,
        });
        tx.objectStore('resource-map').put({
          fakeid: article.fakeid,
          url: article.link,
          resources: [],
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      localStorage.setItem(
        'preferences',
        JSON.stringify({
          hideDeleted: true,
          privateProxyList: ['http://localhost:8787'],
          privateProxyAuthorization: '',
          exportConfig: {
            dirname: '${title}',
            maxlength: 0,
            exportExcelIncludeContent: true,
            exportJsonIncludeComments: false,
            exportJsonIncludeContent: true,
            exportJsonIncludeSummaryEnrichment: summaryEnrichmentEnabled,
            exportHtmlIncludeComments: false,
          },
          downloadConfig: {
            forceDownloadContent: false,
            metadataOverrideContent: false,
          },
          accountSyncSeconds: 3,
          syncDateRange: 'all',
          syncDatePoint: 1345651200,
        })
      );

      if (summaryEnrichmentEnabled) {
        localStorage.setItem(
          summaryStorageKey,
          JSON.stringify({
            [article.link]: {
              article: {
                title: article.title,
                url: article.link,
              },
              summary: {
                text: 'Reviewed local smoke summary for JSON export.',
                keyPoints: ['Synthetic article selected', 'JSON enrichment gate enabled'],
                tags: ['local-smoke', 'json-export'],
                caveat: 'Synthetic browser smoke record. No provider call.',
              },
              review: {
                state: 'accepted_for_export',
                source: 'single_article_panel',
                reviewedAt: summaryReviewedAt,
                reviewer: 'browser-export-smoke',
              },
              runtime: {
                provider: 'deepseek',
                model: 'deepseek-v4-flash',
                mode: 'mock',
                providerCall: false,
                productionChanged: false,
              },
              updatedAt: summaryReviewedAt,
            },
          })
        );
      } else {
        localStorage.removeItem(summaryStorageKey);
      }
    },
    {
      article: smokeArticle,
      html: smokeHtml,
      summaryEnrichmentEnabled: SUMMARY_ENRICHMENT_ENABLED,
      summaryStorageKey: SUMMARY_ENRICHMENT_STORAGE_KEY,
      summaryReviewedAt: SUMMARY_ENRICHMENT_REVIEWED_AT,
    }
  );
}

async function selectSmokeAccount(page) {
  await page.getByText('请选择公众号').click();
  await page.getByText('WCPT Smoke Account').click();
  await page.getByText(smokeArticle.title).waitFor({ timeout: 15_000 });
}

async function selectFirstGridRow(page) {
  const checkbox = page.locator('.ag-selection-checkbox').first();
  await checkbox.waitFor({ timeout: 15_000 });
  await checkbox.click();
}

async function exportByMenu(page, label, expectedExtension) {
  await page.locator('button').filter({ hasText: '导出' }).click();
  const item = page.getByText(label, { exact: true });
  await item.waitFor({ timeout: 10_000 });
  const downloadPromise = page.waitForEvent('download', { timeout: 30_000 });
  await item.click();
  const download = await downloadPromise;
  const suggestedFilename = download.suggestedFilename();
  const targetPath = path.join(DOWNLOAD_DIR, `${Date.now()}-${suggestedFilename}`);
  await download.saveAs(targetPath);
  const size = existsSync(targetPath) ? statSync(targetPath).size : 0;
  if (!suggestedFilename.endsWith(`.${expectedExtension}`)) {
    throw new Error(`Unexpected filename for ${label}: ${suggestedFilename}`);
  }
  if (size <= 0) {
    throw new Error(`Downloaded file is empty for ${label}: ${suggestedFilename}`);
  }
  const contentProof = await inspectDownload(label, expectedExtension, targetPath);
  return {
    label,
    expectedExtension,
    suggestedFilename,
    path: path.relative(ROOT, targetPath),
    size,
    contentProof,
  };
}

async function inspectDownload(label, expectedExtension, filePath) {
  if (expectedExtension === 'zip') {
    const zip = await JSZip.loadAsync(readFileSync(filePath));
    const entries = Object.keys(zip.files).sort();
    if (label === 'HTML') {
      const htmlEntry = entries.find(entry => entry.endsWith('/index.html'));
      if (!htmlEntry) {
        throw new Error('HTML ZIP does not contain index.html');
      }
      const html = await zip.files[htmlEntry].async('string');
      if (!html.includes(smokeArticle.title)) {
        throw new Error('HTML ZIP content does not include smoke article title');
      }
    }
    if (label === 'Markdown') {
      const markdownEntry = entries.find(entry => entry.endsWith('.md'));
      if (!markdownEntry) {
        throw new Error('Markdown ZIP does not contain an md file');
      }
      const markdown = await zip.files[markdownEntry].async('string');
      if (!markdown.includes(smokeArticle.title)) {
        throw new Error('Markdown ZIP content does not include smoke article title');
      }
    }
    if (label === 'Word' && !entries.some(entry => entry.endsWith('.docx'))) {
      throw new Error('Word ZIP does not contain a docx file');
    }
    return { entries };
  }

  if (expectedExtension === 'json') {
    const rows = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!Array.isArray(rows) || rows[0]?.title !== smokeArticle.title) {
      throw new Error('JSON export content does not include smoke article title');
    }
    const enrichment = rows[0]?.summary_enrichment;
    if (!SUMMARY_ENRICHMENT_ENABLED && Object.prototype.hasOwnProperty.call(rows[0], 'summary_enrichment')) {
      throw new Error('JSON export includes summary_enrichment while the default setting is closed');
    }
    if (SUMMARY_ENRICHMENT_ENABLED) {
      if (!enrichment || typeof enrichment !== 'object') {
        throw new Error('JSON export does not include summary_enrichment while the positive gate is enabled');
      }
      if (enrichment.schema !== 'wcpt.summary_enrichment.v1') {
        throw new Error(`Unexpected summary_enrichment schema: ${enrichment.schema}`);
      }
      if (enrichment.review?.state !== 'accepted_for_export' || enrichment.review?.durable_write_allowed !== true) {
        throw new Error('JSON summary_enrichment review state is not accepted_for_export');
      }
      if (enrichment.runtime?.provider_call !== false || enrichment.runtime?.production_changed !== false) {
        throw new Error('JSON summary_enrichment boundary flags are not closed');
      }
      if (enrichment.audit?.export_write_allowed !== true) {
        throw new Error('JSON summary_enrichment audit does not allow export write');
      }
      if (enrichment.llm_summary?.text !== 'Reviewed local smoke summary for JSON export.') {
        throw new Error('JSON summary_enrichment text does not match accepted smoke record');
      }
      return {
        rows: rows.length,
        title: rows[0].title,
        summaryEnrichmentPresent: true,
        schema: enrichment.schema,
        reviewState: enrichment.review.state,
        durableWriteAllowed: enrichment.review.durable_write_allowed,
        providerCall: enrichment.runtime.provider_call,
        productionChanged: enrichment.runtime.production_changed,
        exportWriteAllowed: enrichment.audit.export_write_allowed,
      };
    }
    return { rows: rows.length, title: rows[0].title, summaryEnrichmentPresent: false };
  }

  if (expectedExtension === 'xlsx') {
    const zip = await JSZip.loadAsync(readFileSync(filePath));
    const entries = Object.keys(zip.files).sort();
    const sharedStrings = zip.files['xl/sharedStrings.xml']
      ? await zip.files['xl/sharedStrings.xml'].async('string')
      : '';
    if (!zip.files['xl/workbook.xml']) {
      throw new Error('Excel export does not contain workbook.xml');
    }
    if (!sharedStrings.includes(smokeArticle.title)) {
      throw new Error('Excel export shared strings do not include smoke article title');
    }
    return { entries: entries.length, hasWorkbook: true, includesTitle: true };
  }

  return {};
}

function assertDownloads(downloads) {
  const expected = new Map([
    ['HTML', 'zip'],
    ['Markdown', 'zip'],
    ['Word', 'zip'],
    ['JSON', 'json'],
    ['Excel', 'xlsx'],
  ]);
  for (const [label, extension] of expected.entries()) {
    const item = downloads.find(download => download.label === label);
    if (!item) {
      throw new Error(`Missing download: ${label}`);
    }
    if (item.expectedExtension !== extension || item.size <= 0) {
      throw new Error(`Invalid download: ${label}`);
    }
  }
}

function assertCspHeaders(cspHeaders) {
  const csp = cspHeaders.article || cspHeaders.settings;
  if (!csp) {
    throw new Error('Missing Content-Security-Policy header from local preview');
  }
  if (csp.includes("'unsafe-eval'")) {
    throw new Error('CSP still allows unsafe-eval');
  }

  const directives = new Map(
    csp
      .split(';')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, ...values] = part.split(/\s+/);
        return [name, values];
      })
  );

  const connectSrc = directives.get('connect-src') || [];
  for (const required of [
    "'self'",
    'http://127.0.0.1:*',
    'http://localhost:*',
    'ws://127.0.0.1:*',
    'ws://localhost:*',
    'wss://127.0.0.1:*',
    'wss://localhost:*',
  ]) {
    if (!connectSrc.includes(required)) {
      throw new Error(`CSP connect-src missing ${required}`);
    }
  }
  for (const broadSource of ['http:', 'https:', 'ws:', 'wss:']) {
    if (connectSrc.includes(broadSource)) {
      throw new Error(`CSP connect-src still allows broad ${broadSource}`);
    }
  }

  for (const [name, expected] of [
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'self'"],
  ]) {
    const values = directives.get(name) || [];
    if (!values.includes(expected)) {
      throw new Error(`CSP ${name} missing ${expected}`);
    }
  }
}
