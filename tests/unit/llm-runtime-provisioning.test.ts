import { describe, expect, it } from 'vitest';
import {
  createLlmRuntimeProvisioningReport,
  findPublicSensitiveEnvNames,
  listServerOnlyLlmEnvNames,
} from '~/server/utils/llm-runtime-provisioning';

function runtimeKeyValue() {
  return ['runtime', 'key', 'present'].join('-');
}

function publicEnvName(...parts: string[]) {
  return ['NUXT', 'PUBLIC', ...parts].join('_');
}

describe('LLM runtime provisioning preflight', () => {
  it('keeps the default private deployment blocked and side-effect free', () => {
    const report = createLlmRuntimeProvisioningReport({});

    expect(report.readyForLiveSummary).toBe(false);
    expect(report.blockingReasons).toEqual([
      'llm_disabled',
      'runtime_key_missing',
      'summary_mode_not_live',
      'provider_call_not_authorized',
    ]);
    expect(report.provider_call).toBe(false);
    expect(report.production_changed).toBe(false);
    expect(report.keyPersisted).toBe(false);
  });

  it('reports live readiness by key env name without returning the key value', () => {
    const key = runtimeKeyValue();
    const report = createLlmRuntimeProvisioningReport({
      NUXT_LLM_ENABLED: 'true',
      NUXT_LLM_PROVIDER: 'deepseek',
      NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
      NUXT_LLM_PROVIDER_CALL_AUTHORIZED: 'true',
      NUXT_LLM_DEEPSEEK_API_KEY: key,
    });

    expect(report.readyForLiveSummary).toBe(true);
    expect(report.runtimeKeyPresent).toBe(true);
    expect(report.runtimeKeyEnvName).toBe('NUXT_LLM_DEEPSEEK_API_KEY');
    expect(report.blockingReasons).toEqual([]);
    expect(JSON.stringify(report)).not.toContain(key);
    expect(report.provider_call).toBe(false);
    expect(report.production_changed).toBe(false);
  });

  it('blocks public env names that could expose provider keys to the browser', () => {
    const publicKeyName = publicEnvName('DEEPSEEK', 'API', 'KEY');
    const report = createLlmRuntimeProvisioningReport({
      NUXT_LLM_ENABLED: 'true',
      NUXT_LLM_PROVIDER: 'deepseek',
      NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
      NUXT_LLM_PROVIDER_CALL_AUTHORIZED: 'true',
      NUXT_LLM_DEEPSEEK_API_KEY: runtimeKeyValue(),
      [publicKeyName]: runtimeKeyValue(),
    });

    expect(report.readyForLiveSummary).toBe(false);
    expect(report.publicSensitiveEnvNames).toEqual([publicKeyName]);
    expect(report.blockingReasons).toContain('public_sensitive_env_present');
  });

  it('keeps provider authorization separate from live summary mode', () => {
    const report = createLlmRuntimeProvisioningReport({
      NUXT_LLM_ENABLED: 'true',
      NUXT_LLM_PROVIDER: 'deepseek',
      NUXT_LLM_ARTICLE_SUMMARY_MODE: 'mock',
      NUXT_LLM_PROVIDER_CALL_AUTHORIZED: 'true',
      NUXT_LLM_DEEPSEEK_API_KEY: runtimeKeyValue(),
    });

    expect(report.readyForLiveSummary).toBe(false);
    expect(report.blockingReasons).toEqual(['summary_mode_not_live']);
  });

  it('lists only server-side LLM env slots', () => {
    const names = listServerOnlyLlmEnvNames();

    expect(names).toContain('NUXT_LLM_DEEPSEEK_API_KEY');
    expect(names).toContain('NUXT_LLM_KIMI_API_KEY');
    expect(names.every(name => !name.startsWith('NUXT_PUBLIC_'))).toBe(true);
  });

  it('finds only populated public sensitive env names', () => {
    const emptyPublicKeyName = publicEnvName('DEEPSEEK', 'API', 'KEY');
    const publicTokenName = publicEnvName('KIMI', 'TOKEN');

    expect(
      findPublicSensitiveEnvNames({
        [emptyPublicKeyName]: '',
        NUXT_PUBLIC_METRICS_ENDPOINT: 'https://metrics.example.test',
        [publicTokenName]: runtimeKeyValue(),
      })
    ).toEqual([publicTokenName]);
  });
});
