#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODE = process.env.WCPT_RUNTIME_KEY_PREFLIGHT_MODE || 'default';
const EXPECT_READY = process.env.WCPT_RUNTIME_KEY_PREFLIGHT_EXPECT_READY === '1';
const OUTPUT_DIR = path.join(ROOT, `tmp/outputs/lighthouse-runtime-key-preflight-20260704-${MODE}`);
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');

const SERVER_ONLY_SLOTS = [
  'NUXT_LLM_ENABLED',
  'NUXT_LLM_PROVIDER',
  'NUXT_LLM_REQUEST_TIMEOUT_MS',
  'NUXT_LLM_ARTICLE_SUMMARY_MODE',
  'NUXT_LLM_PROVIDER_CALL_AUTHORIZED',
  'NUXT_LLM_LIVE_POLICY_ACCEPTED',
  'NUXT_LLM_LIVE_MAX_DAILY_CALLS',
  'NUXT_LLM_LIVE_MAX_CONCURRENCY',
  'NUXT_LLM_LIVE_MAX_RETRIES',
  'NUXT_LLM_LIVE_SOURCE_RETENTION',
  'NUXT_LLM_LIVE_EVIDENCE_LEVEL',
  'NUXT_LLM_LIVE_ROLLBACK_MODE',
  'NUXT_LLM_LIVE_OBSERVABILITY',
  'NUXT_LLM_DEEPSEEK_API_KEY',
  'NUXT_LLM_DEEPSEEK_BASE_URL',
  'NUXT_LLM_DEEPSEEK_MODEL',
  'NUXT_LLM_KIMI_API_KEY',
  'NUXT_LLM_KIMI_BASE_URL',
  'NUXT_LLM_KIMI_MODEL',
];

const KEY_ENV_NAMES = [
  'NUXT_LLM_DEEPSEEK_API_KEY',
  'DEEPSEEK_API_KEY',
  'NUXT_LLM_KIMI_API_KEY',
  'KIMI_API_KEY',
  'MOONSHOT_API_KEY',
];

rmSync(OUTPUT_DIR, { recursive: true, force: true });
mkdirSync(OUTPUT_DIR, { recursive: true });

const result = buildResult();
writeFileSync(RESULT_PATH, `${JSON.stringify(result, null, 2)}\n`);
console.log(`result=${path.relative(ROOT, RESULT_PATH)}`);
console.log(`lighthouse_runtime_key_preflight_${MODE}=${result.readyForLiveSummary ? 'ready' : 'not_ready'}`);

if (EXPECT_READY && !result.readyForLiveSummary) {
  process.exitCode = 2;
}

function buildResult() {
  const composePath = path.join(ROOT, 'docker-compose.yml');
  const envExamplePath = path.join(ROOT, '.env.example');
  const composeText = readText(composePath);
  const envExampleText = readText(envExamplePath);
  const composeMissingSlots = SERVER_ONLY_SLOTS.filter(name => !new RegExp(`\\b${name}\\b`).test(composeText));
  const envExampleMissingSlots = SERVER_ONLY_SLOTS.filter(name => !new RegExp(`^${name}=`, 'm').test(envExampleText));
  const publicSensitiveEnvNames = findPublicSensitiveEnvNames(process.env);
  const runtimeKeyEnvName = KEY_ENV_NAMES.find(name => Boolean(process.env[name]));
  const provider = normalizeProvider(process.env.NUXT_LLM_PROVIDER);
  const summaryMode = process.env.NUXT_LLM_ARTICLE_SUMMARY_MODE || 'disabled';
  const providerCallAuthorized = process.env.NUXT_LLM_PROVIDER_CALL_AUTHORIZED === 'true';
  const blockingReasons = [];

  if (!existsSync(composePath)) {
    blockingReasons.push('compose_missing');
  }
  if (composeMissingSlots.length > 0) {
    blockingReasons.push('compose_runtime_slots_missing');
  }
  if (envExampleMissingSlots.length > 0) {
    blockingReasons.push('env_example_runtime_slots_missing');
  }
  if (publicSensitiveEnvNames.length > 0) {
    blockingReasons.push('public_sensitive_env_present');
  }
  if (!provider) {
    blockingReasons.push('unsupported_provider');
  }
  if (process.env.NUXT_LLM_ENABLED !== 'true') {
    blockingReasons.push('llm_disabled');
  }
  if (!runtimeKeyEnvName) {
    blockingReasons.push('runtime_key_missing');
  }
  if (summaryMode !== 'live') {
    blockingReasons.push('summary_mode_not_live');
  }
  if (!providerCallAuthorized) {
    blockingReasons.push('provider_call_not_authorized');
  }

  return {
    schema: 'wcpt.lighthouse_runtime_key_preflight.v1',
    checkedAt: new Date().toISOString(),
    mode: MODE,
    composeRuntimeSlotsReady: composeMissingSlots.length === 0,
    composeMissingSlots,
    envExampleRuntimeSlotsReady: envExampleMissingSlots.length === 0,
    envExampleMissingSlots,
    provider: provider || 'unsupported',
    model: modelForProvider(provider),
    summaryMode,
    llmEnabled: process.env.NUXT_LLM_ENABLED === 'true',
    providerCallAuthorized,
    runtimeKeyPresent: Boolean(runtimeKeyEnvName),
    runtimeKeyEnvName,
    runtimeKeyValueReturned: false,
    publicSensitiveEnvNames,
    readyForLiveSummary: blockingReasons.length === 0,
    blockingReasons,
    provider_call: false,
    production_changed: false,
    keyPersisted: false,
  };
}

function readText(file) {
  return existsSync(file) ? readFileSync(file, 'utf8') : '';
}

function normalizeProvider(value) {
  if (!value) return 'deepseek';
  if (value === 'deepseek' || value === 'kimi') return value;
  return null;
}

function modelForProvider(provider) {
  if (provider === 'kimi') {
    return process.env.NUXT_LLM_KIMI_MODEL || 'kimi-k2.6';
  }
  return process.env.NUXT_LLM_DEEPSEEK_MODEL || 'deepseek-v4-flash';
}

function findPublicSensitiveEnvNames(env) {
  return Object.keys(env)
    .filter(name => name.startsWith('NUXT_PUBLIC_'))
    .filter(name => /(?:LLM|DEEPSEEK|KIMI|MOONSHOT|OPENAI|API_?KEY|TOKEN|SECRET|PASSWORD|PRIVATE)/i.test(name))
    .filter(name => Boolean(env[name]))
    .sort();
}
