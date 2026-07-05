import { describe, expect, it } from 'vitest';
import {
  createLlmLiveProviderPolicyReport,
  listLiveProviderPolicyEnvNames,
} from '~/server/utils/llm-live-provider-policy';

function runtimeKeyValue() {
  return ['runtime', 'policy', 'key'].join('-');
}

function readyShapeEnv() {
  return {
    NUXT_LLM_ENABLED: 'true',
    NUXT_LLM_PROVIDER: 'deepseek',
    NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
    NUXT_LLM_PROVIDER_CALL_AUTHORIZED: 'true',
    NUXT_LLM_DEEPSEEK_API_KEY: runtimeKeyValue(),
    NUXT_LLM_LIVE_POLICY_ACCEPTED: 'true',
  };
}

function publicEnvName(...parts: string[]) {
  return ['NUXT', 'PUBLIC', ...parts].join('_');
}

describe('LLM live provider policy', () => {
  it('keeps the default policy blocked and side-effect free', () => {
    const report = createLlmLiveProviderPolicyReport({});

    expect(report.readyForProductionLiveProvider).toBe(false);
    expect(report.blockingReasons).toEqual(['policy_not_accepted', 'runtime_not_ready']);
    expect(report.runtimeBlockingReasons).toEqual([
      'llm_disabled',
      'runtime_key_missing',
      'summary_mode_not_live',
      'provider_call_not_authorized',
    ]);
    expect(report.provider_call).toBe(false);
    expect(report.production_changed).toBe(false);
    expect(report.keyPersisted).toBe(false);
  });

  it('allows a ready shape without returning key values or provider calls', () => {
    const key = runtimeKeyValue();
    const report = createLlmLiveProviderPolicyReport({
      ...readyShapeEnv(),
      NUXT_LLM_DEEPSEEK_API_KEY: key,
    });

    expect(report.readyForProductionLiveProvider).toBe(true);
    expect(report.blockingReasons).toEqual([]);
    expect(report.runtimeReadyForLiveSummary).toBe(true);
    expect(report.limits).toMatchObject({
      maxDailyCalls: 100,
      maxConcurrency: 1,
      maxRetries: 0,
      maxRequestTimeoutMs: 30000,
    });
    expect(report.dataPolicy).toMatchObject({
      sourceRetention: 'none',
      evidenceLevel: 'sanitized_metrics_only',
      sourceTextReturned: false,
      rawProviderResponsePersisted: false,
    });
    expect(JSON.stringify(report)).not.toContain(key);
    expect(report.provider_call).toBe(false);
  });

  it('blocks request timeouts above the production policy limit', () => {
    const report = createLlmLiveProviderPolicyReport({
      ...readyShapeEnv(),
      NUXT_LLM_REQUEST_TIMEOUT_MS: '45000',
    });

    expect(report.readyForProductionLiveProvider).toBe(false);
    expect(report.blockingReasons).toEqual(['request_timeout_over_policy']);
  });

  it('blocks unsafe cost, concurrency, retry, and data-retention settings', () => {
    const report = createLlmLiveProviderPolicyReport({
      ...readyShapeEnv(),
      NUXT_LLM_LIVE_MAX_DAILY_CALLS: '500',
      NUXT_LLM_LIVE_MAX_CONCURRENCY: '5',
      NUXT_LLM_LIVE_MAX_RETRIES: '3',
      NUXT_LLM_LIVE_SOURCE_RETENTION: 'raw_article_text',
      NUXT_LLM_LIVE_EVIDENCE_LEVEL: 'raw_response',
    });

    expect(report.readyForProductionLiveProvider).toBe(false);
    expect(report.blockingReasons).toEqual([
      'daily_call_limit_invalid',
      'concurrency_limit_invalid',
      'retry_limit_invalid',
      'source_retention_not_none',
      'evidence_not_sanitized',
    ]);
  });

  it('blocks unsafe rollback, observability, and public sensitive env exposure', () => {
    const publicKeyName = publicEnvName('DEEPSEEK', 'API', 'KEY');
    const report = createLlmLiveProviderPolicyReport({
      ...readyShapeEnv(),
      NUXT_LLM_LIVE_ROLLBACK_MODE: 'live',
      NUXT_LLM_LIVE_OBSERVABILITY: 'raw_prompt_logs',
      [publicKeyName]: runtimeKeyValue(),
    });

    expect(report.readyForProductionLiveProvider).toBe(false);
    expect(report.publicSensitiveEnvNames).toEqual([publicKeyName]);
    expect(report.blockingReasons).toEqual([
      'runtime_not_ready',
      'public_sensitive_env_present',
      'rollback_mode_invalid',
      'observability_policy_invalid',
    ]);
  });

  it('lists only server-side policy env slots', () => {
    const names = listLiveProviderPolicyEnvNames();

    expect(names).toContain('NUXT_LLM_LIVE_POLICY_ACCEPTED');
    expect(names).toContain('NUXT_LLM_LIVE_MAX_DAILY_CALLS');
    expect(names.every(name => !name.startsWith('NUXT_PUBLIC_'))).toBe(true);
  });
});
