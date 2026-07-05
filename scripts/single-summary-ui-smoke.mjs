#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODE = process.env.WCPT_SUMMARY_MODE || 'mock';
const LIVE_MODE = MODE === 'live';
const VIEWPORT = process.env.WCPT_SMOKE_VIEWPORT || 'desktop';
const OUTPUT_SUFFIX = VIEWPORT === 'desktop' ? MODE : `${MODE}-${VIEWPORT}`;
const OUTPUT_DIR = path.join(ROOT, `tmp/outputs/single-summary-ui-smoke-20260704-${OUTPUT_SUFFIX}`);
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');
const SCREENSHOT_PATH = path.join(OUTPUT_DIR, 'single-summary.png');
const PORT = Number(process.env.WCPT_SMOKE_PORT || defaultPortForMode(MODE));
const HOST = '127.0.0.1';
const BASE_URL = process.env.WCPT_SMOKE_BASE_URL || `http://${HOST}:${PORT}`;
const START_SERVER = !process.env.WCPT_SMOKE_BASE_URL;
const PLAYWRIGHT_MODULE_DIR = findPlaywrightModuleDir();
const REVIEW_EDIT_TEXT = '人工复核后摘要：公众号归档与同源摘要链路。';

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const { chromium } = loadPlaywright();

const smokeRow = {
  id: 'single-summary-smoke-row',
  fakeid: 'SINGLE_ARTICLE_FAKEID',
  aid: '100000001_1',
  link: 'https://mp.weixin.qq.com/s/wcpt-single-summary-smoke',
  title: 'WCPT Single Summary Smoke',
  author_name: 'Codex',
  digest: 'DeepSeek mock 摘要面板 smoke 内容。',
  cover: '',
  create_time: 1_774_972_800,
  update_time: 1_774_972_860,
  appmsgid: 100000001,
  itemidx: 1,
  contentDownload: true,
  commentDownload: false,
  accountName: 'WCPT Smoke Account',
  _status: '正常',
  is_deleted: false,
};

const smokeHtml = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${smokeRow.title}</title>
</head>
<body>
  <div id="js_article">
    <h1 id="activity-name">${smokeRow.title}</h1>
    <div id="meta_content"><span id="js_name">WCPT Smoke Account</span></div>
    <div id="js_content">
      <p>第一段介绍公众号文章归档。</p>
      <p>第二段介绍 DeepSeek 摘要 UI gate。</p>
      <p>第三段确认浏览器只调用同源摘要接口。</p>
      <p>第四段说明结果必须由人工复核后才能进入导出或持久化。</p>
    </div>
  </div>
</body>
</html>`;

let serverProcess = null;
let browser = null;

try {
  if (LIVE_MODE && !hasRuntimeDeepSeekKey()) {
    writeFileSync(
      RESULT_PATH,
      `${JSON.stringify(
        {
          mode: MODE,
          ok: false,
          code: 'runtime_key_missing',
          provider_call: false,
          production_changed: false,
          keyPersisted: false,
        },
        null,
        2
      )}\n`
    );
    console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
    console.log('single_summary_ui_smoke_live=runtime_key_missing');
    process.exit(2);
  }

  if (START_SERVER) {
    serverProcess = await startServer();
  } else {
    await waitForHttp(`${BASE_URL}/dashboard/single`);
  }

  browser = await launchBrowser();
  const context = await browser.newContext(createContextOptions(VIEWPORT));
  const page = await context.newPage();
  const requests = [];
  page.on('request', request => {
    requests.push({
      method: request.method(),
      url: request.url(),
      resourceType: request.resourceType(),
    });
  });

  await page.goto(`${BASE_URL}/dashboard/settings`, { waitUntil: 'networkidle' });
  await seedSingleArticle(page);
  const pageResponse = await page.goto(`${BASE_URL}/dashboard/single`, { waitUntil: 'networkidle' });

  await page.getByText(smokeRow.title).waitFor({ timeout: 15_000 });
  await page.locator('.ag-selection-checkbox').first().click();
  await page.getByRole('button', { name: '生成摘要' }).click();

  const resultLocator = page.getByTestId('single-article-summary-result');
  const emptyLocator = page.getByTestId('single-article-summary-empty');
  let uiProof;
  let reviewProof = { state: 'not_applicable' };
  if (MODE === 'mock') {
    await resultLocator.waitFor({ timeout: 15_000 });
    const text = await resultLocator.textContent();
    if (!text?.includes('providerCallAttempted: false')) {
      throw new Error('Mock summary panel did not record providerCallAttempted false');
    }
    if (!text.includes('DeepSeek 摘要 UI gate')) {
      throw new Error('Mock summary panel did not render expected summary content');
    }
    reviewProof = await exerciseReviewControls(page);
    uiProof = { state: 'summary-rendered', text };
  } else if (LIVE_MODE) {
    await resultLocator.waitFor({ timeout: 45_000 });
    const text = await resultLocator.textContent();
    if (!text?.includes('providerCallAttempted: true')) {
      throw new Error('Live summary panel did not record providerCallAttempted true');
    }
    if (!text.includes('mode: live')) {
      throw new Error('Live summary panel did not render live mode boundary');
    }
    if (!text.includes('provider: deepseek')) {
      throw new Error('Live summary panel did not render DeepSeek provider boundary');
    }
    reviewProof = await exerciseReviewControls(page);
    uiProof = {
      state: 'live-summary-rendered',
      textLength: text.length,
      hasProviderCallAttempted: true,
      hasLiveModeBoundary: true,
      hasDeepSeekBoundary: true,
    };
  } else {
    await emptyLocator.waitFor({ timeout: 15_000 });
    await page.waitForFunction(
      () => document.querySelector('[data-testid="single-article-summary-empty"]')?.textContent?.includes('disabled'),
      undefined,
      { timeout: 15_000 }
    );
    const text = await emptyLocator.textContent();
    writeFileSync(path.join(OUTPUT_DIR, 'disabled-panel-text.txt'), `${text || ''}\n`);
    if (!text?.includes('摘要能力当前保持 disabled')) {
      throw new Error(`Disabled summary panel did not render disabled boundary text: ${text || ''}`);
    }
    uiProof = { state: 'disabled-boundary-rendered', text };
  }

  await page.screenshot({ path: SCREENSHOT_PATH, fullPage: true });

  const externalRequests = requests.filter(request => {
    const url = new URL(request.url);
    return url.origin !== BASE_URL;
  });
  if (externalRequests.length > 0) {
    throw new Error(`Unexpected external requests: ${externalRequests.map(request => request.url).join(', ')}`);
  }

  const summaryRequests = requests.filter(request => request.url.endsWith('/api/web/llm/article-summary'));
  if (summaryRequests.length !== 1) {
    throw new Error(`Expected one local summary API request, got ${summaryRequests.length}`);
  }

  const result = {
    mode: MODE,
    viewport: VIEWPORT,
    baseUrl: BASE_URL,
    playwrightModuleDir: PLAYWRIGHT_MODULE_DIR,
    cspHeader: pageResponse?.headers()['content-security-policy'] || '',
    seededArticle: {
      link: smokeRow.link,
      title: smokeRow.title,
      contentDownload: smokeRow.contentDownload,
    },
    uiProof,
    reviewProof,
    summaryRequests,
    externalRequests,
    screenshot: path.relative(ROOT, SCREENSHOT_PATH),
    provider_call: LIVE_MODE,
    production_changed: false,
    keyPersisted: false,
  };

  writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
  console.log(`single_summary_ui_smoke_${MODE}_${VIEWPORT}=pass`);
} finally {
  if (browser) {
    await browser.close();
  }
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await delay(500);
  }
}

function defaultPortForMode(mode) {
  if (mode === 'disabled') return 41952;
  if (mode === 'live') return 41953;
  return 41951;
}

function createContextOptions(viewport) {
  if (viewport === 'mobile') {
    return {
      viewport: { width: 390, height: 844 },
      isMobile: true,
      deviceScaleFactor: 2,
    };
  }
  if (viewport === 'desktop') {
    return {
      viewport: { width: 1440, height: 960 },
    };
  }
  throw new Error(`Unsupported WCPT_SMOKE_VIEWPORT: ${viewport}`);
}

function hasRuntimeDeepSeekKey() {
  return Boolean(process.env.NUXT_LLM_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY);
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
      NUXT_LLM_ENABLED: LIVE_MODE ? 'true' : 'false',
      NUXT_LLM_PROVIDER: 'deepseek',
      NUXT_LLM_DEEPSEEK_MODEL: process.env.NUXT_LLM_DEEPSEEK_MODEL || 'deepseek-v4-flash',
      NUXT_LLM_REQUEST_TIMEOUT_MS: process.env.NUXT_LLM_REQUEST_TIMEOUT_MS || '30000',
      NUXT_LLM_ARTICLE_SUMMARY_MODE: MODE,
      NUXT_LLM_PROVIDER_CALL_AUTHORIZED: LIVE_MODE ? 'true' : 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const logPath = path.join(OUTPUT_DIR, 'server.log');
  child.stdout.on('data', chunk => appendLog(logPath, chunk));
  child.stderr.on('data', chunk => appendLog(logPath, chunk));
  await waitForHttp(`${BASE_URL}/dashboard/single`);
  return child;
}

function appendLog(file, chunk) {
  writeFileSync(file, chunk, { flag: 'a' });
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

async function exerciseReviewControls(page) {
  await waitForTestIdText(page, 'single-article-summary-review', 'review: draft_generated');
  await waitForTestIdText(page, 'single-article-summary-review', 'durableWriteAllowed: false');

  await page.getByTestId('single-article-review-edit').click();
  await page.getByTestId('single-article-review-editor').fill(REVIEW_EDIT_TEXT);
  await page.getByTestId('single-article-review-save').click();
  await waitForTestIdText(page, 'single-article-summary-result', REVIEW_EDIT_TEXT);
  await waitForTestIdText(page, 'single-article-summary-review', 'review: draft_generated');

  await page.getByTestId('single-article-review-accept').click();
  await waitForTestIdText(page, 'single-article-summary-review', 'review: accepted_for_session');
  await waitForTestIdText(page, 'single-article-summary-review', 'accepted: true');
  await waitForTestIdText(page, 'single-article-summary-review', 'durableWriteAllowed: false');

  await page.getByTestId('single-article-review-reject').click();
  await waitForTestIdText(page, 'single-article-summary-review', 'review: rejected');
  await waitForTestIdText(page, 'single-article-summary-review', 'accepted: false');

  return {
    state: 'review-controls-verified',
    draftGenerated: true,
    editSaved: true,
    acceptedForSession: true,
    rejected: true,
    durableWriteAllowed: false,
  };
}

async function waitForTestIdText(page, testId, expectedText) {
  await page.waitForFunction(
    ({ id, text }) => document.querySelector(`[data-testid="${id}"]`)?.textContent?.includes(text),
    { id: testId, text: expectedText },
    { timeout: 15_000 }
  );
}

async function seedSingleArticle(page) {
  await page.evaluate(
    async ({ row, html }) => {
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
        const tx = db.transaction(['article', 'html'], 'readwrite');
        tx.objectStore('article').put(
          {
            ...row,
            album_id: '',
            appmsg_album_infos: [],
            ban_flag: 0,
            checking: 0,
            copyright_stat: 0,
            copyright_type: 0,
            cover_img: '',
            has_red_packet_cover: 0,
            is_pay_subscribe: 0,
            item_show_type: 0,
            media_duration: '0:00',
            mediaapi_publish_status: 0,
            pic_cdn_url_1_1: '',
            pic_cdn_url_3_4: '',
            pic_cdn_url_16_9: '',
            pic_cdn_url_235_1: '',
            _single: true,
          },
          `${row.fakeid}:${row.aid}`
        );
        tx.objectStore('html').put({
          fakeid: row.fakeid,
          url: row.link,
          title: row.title,
          commentID: null,
          file: new Blob([html], { type: 'text/html;charset=utf-8' }),
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });

      localStorage.setItem('single-article:rows', JSON.stringify([row]));
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
    },
    { row: smokeRow, html: smokeHtml }
  );
}
