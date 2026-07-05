#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MODE = process.env.WCPT_LIVE_PROVIDER_POLICY_PREFLIGHT_MODE || 'default';
const EXPECT_READY = process.env.WCPT_LIVE_PROVIDER_POLICY_EXPECT_READY === '1';
const OUTPUT_DIR = path.join(ROOT, `tmp/outputs/live-provider-policy-preflight-20260704-${MODE}`);
const RESULT_PATH = path.join(OUTPUT_DIR, 'result.json');

const POLICY_ENV_NAMES = [
  'NUXT_LLM_LIVE_POLICY_ACCEPTED',
  'NUXT_LLM_LIVE_MAX_DAILY_CALLS',
  'NUXT_LLM_LIVE_MAX_CONCURRENCY',
  'NUXT_LLM_LIVE_MAX_RETRIES',
  'NUXT_LLM_LIVE_SOURCE_RETENTION',
  'NUXT_LLM_LIVE_EVIDENCE_LEVEL',
  'NUXT_LLM_LIVE_ROLLBACK_MODE',
  'NUXT_LLM_LIVE_OBSERVABILITY',
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
console.log(`live_provider_policy_preflight_${MODE}=${result.readyForProductionLiveProvider ? 'ready' : 'not_ready'}`);

if (EXPECT_READY && !result.readyForProductionLiveProvider) {
  process.exitCode = 2;
}

function buildResult() {
  const envExampleText = readText('.env.example');
  const composeText = readText('docker-compose.yml');
  const policyEnvMissingFromEnvExample = POLICY_ENV_NAMES.filter(name => !new RegExp(`^${name}=`, 'm').test(envExampleText));
  const policyEnvMissingFromCompose = POLICY_ENV_NAMES.filter(name => !new RegExp(`\\b${name}\\b`).test(composeText));
  const runtime = buildRuntimeReadiness();
  const policy = buildPolicy(runtime);
  const blockers = [...policy.blockingReasons];

  if (policyEnvMissingFromEnvExample.length > 0) {
    blockers.push('env_example_policy_slots_missing');
  }
  if (policyEnvMissingFromCompose.length > 0) {
    blockers.push('compose_policy_slots_missing');
  }

  return {
    schema: 'wcpt.llm_live_provider_policy_preflight.v1',
    checkedAt: new Date().toISOString(),
    mode: MODE,
    policyEnvSlotsReady: policyEnvMissingFromEnvExample.length === 0 && policyEnvMissingFromCompose.length === 0,
    policyEnvMissingFromEnvExample,
    policyEnvMissingFromCompose,
    ...policy,
    readyForProductionLiveProvider: blockers.length === 0,
    blockingReasons: blockers,
    runtimeKeyValueReturned: false,
    provider_call: false,
    production_changed: false,
    keyPersisted: false,
  };
}

function buildRuntimeReadiness() {
  const provider = normalizeProvider(process.env.NUXT_LLM_PROVIDER);
  const runtimeKeyEnvName = KEY_ENV_NAMES.find(name => Boolean(process.env[name]));
  const summaryMode = process.env.NUXT_LLM_ARTICLE_SUMMARY_MODE || 'disabled';
  const providerCallAuthorized = process.env.NUXT_LLM_PROVIDER_CALL_AUTHORIZED === 'true';
  const publicSensitiveEnvNames = findPublicSensitiveEnvNames(process.env);
  const blockingReasons = [];

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
    provider: provider || 'deepseek',
    model: modelForProvider(provider),
    requestTimeoutMs: normalizeInteger(process.env.NUXT_LLM_REQUEST_TIMEOUT_MS, 30000),
    runtimeReadyForLiveSummary: blockingReasons.length === 0,
    runtimeBlockingReasons: blockingReasons,
    runtimeKeyPresent: Boolean(runtimeKeyEnvName),
    runtimeKeyEnvName,
    publicSensitiveEnvNames,
  };
}

function buildPolicy(runtime) {
  const maxDailyCalls = normalizeInteger(process.env.NUXT_LLM_LIVE_MAX_DAILY_CALLS, 100);
  const maxConcurrency = normalizeInteger(process.env.NUXT_LLM_LIVE_MAX_CONCURRENCY, 1);
  const maxRetries = normalizeInteger(process.env.NUXT_LLM_LIVE_MAX_RETRIES, 0);
  const sourceRetention = process.env.NUXT_LLM_LIVE_SOURCE_RETENTION || 'none';
  const evidenceLevel = process.env.NUXT_LLM_LIVE_EVIDENCE_LEVEL || 'sanitized_metrics_only';
  const rollbackMode = process.env.NUXT_LLM_LIVE_ROLLBACK_MODE || 'disabled';
  const observabilityMode = process.env.NUXT_LLM_LIVE_OBSERVABILITY || 'local_sanitized';
  const blockingReasons = [];

  if (process.env.NUXT_LLM_LIVE_POLICY_ACCEPTED !== 'true') {
    blockingReasons.push('policy_not_accepted');
  }
  if (!runtime.runtimeReadyForLiveSummary) {
    blockingReasons.push('runtime_not_ready');
  }
  if (runtime.publicSensitiveEnvNames.length > 0) {
    blockingReasons.push('public_sensitive_env_present');
  }
  if (runtime.requestTimeoutMs > 30000) {
    blockingReasons.push('request_timeout_over_policy');
  }
  if (maxDailyCalls < 1 || maxDailyCalls > 200) {
    blockingReasons.push('daily_call_limit_invalid');
  }
  if (maxConcurrency < 1 || maxConcurrency > 2) {
    blockingReasons.push('concurrency_limit_invalid');
  }
  if (maxRetries < 0 || maxRetries > 1) {
    blockingReasons.push('retry_limit_invalid');
  }
  if (sourceRetention !== 'none') {
    blockingReasons.push('source_retention_not_none');
  }
  if (evidenceLevel !== 'sanitized_metrics_only') {
    blockingReasons.push('evidence_not_sanitized');
  }
  if (rollbackMode !== 'disabled' && rollbackMode !== 'mock') {
    blockingReasons.push('rollback_mode_invalid');
  }
  if (observabilityMode !== 'local_sanitized') {
    blockingReasons.push('observability_policy_invalid');
  }

  return {
    provider: runtime.provider,
    model: runtime.model,
    requestTimeoutMs: runtime.requestTimeoutMs,
    policyAccepted: process.env.NUXT_LLM_LIVE_POLICY_ACCEPTED === 'true',
    runtimeReadyForLiveSummary: runtime.runtimeReadyForLiveSummary,
    runtimeBlockingReasons: runtime.runtimeBlockingReasons,
    publicSensitiveEnvNames: runtime.publicSensitiveEnvNames,
    limits: {
      maxDailyCalls,
      maxConcurrency,
      maxRetries,
      maxRequestTimeoutMs: 30000,
    },
    dataPolicy: {
      sourceRetention,
      evidenceLevel,
      sourceTextReturned: false,
      rawProviderResponsePersisted: false,
    },
    rollback: {
      mode: rollbackMode,
      targetEnv: 'NUXT_LLM_ARTICLE_SUMMARY_MODE',
    },
    observability: {
      mode: observabilityMode,
      articleTextLogged: false,
      providerKeyLogged: false,
    },
    blockingReasons,
  };
}

function readText(relativePath) {
  const file = path.join(ROOT, relativePath);
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

function normalizeInteger(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function findPublicSensitiveEnvNames(env) {
  return Object.keys(env)
    .filter(name => name.startsWith('NUXT_PUBLIC_'))
    .filter(name => /(?:LLM|DEEPSEEK|KIMI|MOONSHOT|OPENAI|API_?KEY|TOKEN|SECRET|PASSWORD|PRIVATE)/i.test(name))
    .filter(name => Boolean(env[name]))
    .sort();
}
