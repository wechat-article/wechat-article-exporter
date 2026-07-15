#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const ROOT = path.resolve(import.meta.dirname, '..');
const LIVE_APPROVED = process.env.WCPT_DEEPSEEK_LIVE_PREFLIGHT === '1';
const HAS_RUNTIME_KEY = Boolean(process.env.NUXT_LLM_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY);
const MODE = LIVE_APPROVED ? 'live' : 'no-key-boundary';
const OUTPUT_DIR = path.join(ROOT, `tmp/outputs/deepseek-live-preflight-20260704-${MODE}`);
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');
const PORT = Number(process.env.WCPT_DEEPSEEK_PREFLIGHT_PORT || (LIVE_APPROVED ? 41961 : 41960));
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

if (LIVE_APPROVED && !HAS_RUNTIME_KEY) {
  writeResult({
    mode: MODE,
    ok: false,
    code: 'runtime_key_missing',
    providerCallAttempted: false,
    provider_call: false,
    production_changed: false,
    keyPersisted: false,
  });
  console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
  console.log('deepseek_live_preflight=runtime_key_missing');
  process.exit(2);
}

let serverProcess = null;

try {
  serverProcess = await startServer();
  const response = await fetch(`${BASE_URL}/api/web/llm/article-summary`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'WCPT DeepSeek Live Preflight',
      url: 'local://wcpt/deepseek-live-preflight',
      content:
        'WCPT 本地验收内容：检验微信公众号文章归档摘要链路，要求返回严格 JSON，摘要保持简短，不能改变生产环境。',
    }),
  });
  const body = await response.json().catch(() => null);
  const result = sanitizeResult(response.status, body);
  writeResult(result);

  console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
  console.log(`deepseek_live_preflight_${MODE}=${result.ok ? 'pass' : 'not_ready'}`);

  if (LIVE_APPROVED && (!result.ok || result.providerCallAttempted !== true)) {
    process.exitCode = 2;
  }
  if (!LIVE_APPROVED && (result.code !== 'LLM_API_KEY_MISSING' || result.providerCallAttempted !== false)) {
    process.exitCode = 2;
  }
} finally {
  if (serverProcess) {
    serverProcess.kill('SIGTERM');
    await delay(500);
  }
}

function startServer() {
  const indexPath = path.join(ROOT, '.output/server/index.mjs');
  if (!existsSync(indexPath)) {
    throw new Error('Build artifact missing. Run yarn build first.');
  }

  return new Promise((resolve, reject) => {
    const env = buildServerEnv();
    const child = spawn(process.execPath, [indexPath], {
      cwd: ROOT,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const logPath = path.join(OUTPUT_DIR, 'server.log');
    child.stdout.on('data', chunk => appendLog(logPath, chunk));
    child.stderr.on('data', chunk => appendLog(logPath, chunk));
    child.once('exit', code => {
      reject(new Error(`Server exited before ready; code=${code ?? 'null'}`));
    });

    waitForHttp(`${BASE_URL}/dashboard/single`)
      .then(() => resolve(child))
      .catch(reject);
  });
}

function buildServerEnv() {
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    HOST,
    PORT: String(PORT),
    NITRO_KV_DRIVER: 'memory',
    NUXT_OPEN_API_ENABLED: 'false',
    NUXT_LLM_ENABLED: 'true',
    NUXT_LLM_PROVIDER: 'deepseek',
    NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
    NUXT_LLM_PROVIDER_CALL_AUTHORIZED: LIVE_APPROVED ? 'true' : 'true',
    NUXT_LLM_DEEPSEEK_MODEL: process.env.NUXT_LLM_DEEPSEEK_MODEL || 'deepseek-v4-flash',
    NUXT_LLM_REQUEST_TIMEOUT_MS: process.env.NUXT_LLM_REQUEST_TIMEOUT_MS || '30000',
  };

  if (!LIVE_APPROVED) {
    delete env.NUXT_LLM_DEEPSEEK_API_KEY;
    delete env.DEEPSEEK_API_KEY;
  }

  return env;
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

function sanitizeResult(httpStatus, body) {
  const payload = body && typeof body === 'object' ? body : {};
  const ok = payload.ok === true;
  return {
    checkedAt: new Date().toISOString(),
    mode: MODE,
    endpoint: '/api/web/llm/article-summary',
    httpStatus,
    ok,
    code: typeof payload.code === 'string' ? payload.code : undefined,
    provider: payload.provider === 'deepseek' ? payload.provider : String(payload.provider || ''),
    model: typeof payload.model === 'string' ? payload.model : '',
    providerCallAttempted: payload.providerCallAttempted === true,
    summaryShape: ok ? sanitizeSummaryShape(payload.summary) : null,
    keyPersisted: false,
    provider_call: payload.providerCallAttempted === true,
    production_changed: false,
  };
}

function sanitizeSummaryShape(summary) {
  const value = summary && typeof summary === 'object' ? summary : {};
  return {
    titleLength: typeof value.title === 'string' ? value.title.length : 0,
    summaryLength: typeof value.summary === 'string' ? value.summary.length : 0,
    keyPointCount: Array.isArray(value.key_points) ? value.key_points.length : 0,
    tagCount: Array.isArray(value.tags) ? value.tags.length : 0,
    caveatLength: typeof value.caveat === 'string' ? value.caveat.length : 0,
  };
}

function writeResult(result) {
  writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
}
