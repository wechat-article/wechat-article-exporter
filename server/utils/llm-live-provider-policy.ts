import { DEFAULT_LLM_REQUEST_TIMEOUT_MS, resolveLlmRuntimeConfig, type LlmEnv, type LlmProvider } from './llm-adapter';
import { createLlmRuntimeProvisioningReport } from './llm-runtime-provisioning';

export const LLM_LIVE_PROVIDER_POLICY_SCHEMA = 'wcpt.llm_live_provider_policy.v1';

export const LLM_LIVE_POLICY_ACCEPTED_ENV = 'NUXT_LLM_LIVE_POLICY_ACCEPTED';
export const LLM_LIVE_MAX_DAILY_CALLS_ENV = 'NUXT_LLM_LIVE_MAX_DAILY_CALLS';
export const LLM_LIVE_MAX_CONCURRENCY_ENV = 'NUXT_LLM_LIVE_MAX_CONCURRENCY';
export const LLM_LIVE_MAX_RETRIES_ENV = 'NUXT_LLM_LIVE_MAX_RETRIES';
export const LLM_LIVE_SOURCE_RETENTION_ENV = 'NUXT_LLM_LIVE_SOURCE_RETENTION';
export const LLM_LIVE_EVIDENCE_LEVEL_ENV = 'NUXT_LLM_LIVE_EVIDENCE_LEVEL';
export const LLM_LIVE_ROLLBACK_MODE_ENV = 'NUXT_LLM_LIVE_ROLLBACK_MODE';
export const LLM_LIVE_OBSERVABILITY_ENV = 'NUXT_LLM_LIVE_OBSERVABILITY';

export const MAX_POLICY_TIMEOUT_MS = 30_000;
export const MAX_POLICY_DAILY_CALLS = 200;
export const MAX_POLICY_CONCURRENCY = 2;
export const MAX_POLICY_RETRIES = 1;

export type LlmLiveSourceRetention = 'none';
export type LlmLiveEvidenceLevel = 'sanitized_metrics_only';
export type LlmLiveRollbackMode = 'disabled' | 'mock';
export type LlmLiveObservability = 'local_sanitized';

export type LlmLiveProviderPolicyBlockCode =
  | 'policy_not_accepted'
  | 'runtime_not_ready'
  | 'public_sensitive_env_present'
  | 'request_timeout_over_policy'
  | 'daily_call_limit_invalid'
  | 'concurrency_limit_invalid'
  | 'retry_limit_invalid'
  | 'source_retention_not_none'
  | 'evidence_not_sanitized'
  | 'rollback_mode_invalid'
  | 'observability_policy_invalid';

export interface LlmLiveProviderPolicyReport {
  schema: typeof LLM_LIVE_PROVIDER_POLICY_SCHEMA;
  provider: LlmProvider;
  model: string;
  requestTimeoutMs: number;
  policyAccepted: boolean;
  runtimeReadyForLiveSummary: boolean;
  runtimeBlockingReasons: string[];
  publicSensitiveEnvNames: string[];
  limits: {
    maxDailyCalls: number;
    maxConcurrency: number;
    maxRetries: number;
    maxRequestTimeoutMs: typeof MAX_POLICY_TIMEOUT_MS;
  };
  dataPolicy: {
    sourceRetention: LlmLiveSourceRetention | string;
    evidenceLevel: LlmLiveEvidenceLevel | string;
    sourceTextReturned: false;
    rawProviderResponsePersisted: false;
  };
  rollback: {
    mode: LlmLiveRollbackMode | string;
    targetEnv: 'NUXT_LLM_ARTICLE_SUMMARY_MODE';
  };
  observability: {
    mode: LlmLiveObservability | string;
    articleTextLogged: false;
    providerKeyLogged: false;
  };
  readyForProductionLiveProvider: boolean;
  blockingReasons: LlmLiveProviderPolicyBlockCode[];
  provider_call: false;
  production_changed: false;
  keyPersisted: false;
}

export function createLlmLiveProviderPolicyReport(env: LlmEnv = process.env): LlmLiveProviderPolicyReport {
  const runtimeReport = createLlmRuntimeProvisioningReport(env);
  const runtimeConfig = resolveLlmRuntimeConfig(env);
  const policyAccepted = env[LLM_LIVE_POLICY_ACCEPTED_ENV] === 'true';
  const maxDailyCalls = normalizeBoundedInteger(env[LLM_LIVE_MAX_DAILY_CALLS_ENV], 100);
  const maxConcurrency = normalizeBoundedInteger(env[LLM_LIVE_MAX_CONCURRENCY_ENV], 1);
  const maxRetries = normalizeBoundedInteger(env[LLM_LIVE_MAX_RETRIES_ENV], 0);
  const sourceRetention = env[LLM_LIVE_SOURCE_RETENTION_ENV] || 'none';
  const evidenceLevel = env[LLM_LIVE_EVIDENCE_LEVEL_ENV] || 'sanitized_metrics_only';
  const rollbackMode = env[LLM_LIVE_ROLLBACK_MODE_ENV] || 'disabled';
  const observabilityMode = env[LLM_LIVE_OBSERVABILITY_ENV] || 'local_sanitized';
  const blockingReasons: LlmLiveProviderPolicyBlockCode[] = [];

  if (!policyAccepted) {
    blockingReasons.push('policy_not_accepted');
  }
  if (!runtimeReport.readyForLiveSummary) {
    blockingReasons.push('runtime_not_ready');
  }
  if (runtimeReport.publicSensitiveEnvNames.length > 0) {
    blockingReasons.push('public_sensitive_env_present');
  }
  if (runtimeConfig.requestTimeoutMs > MAX_POLICY_TIMEOUT_MS) {
    blockingReasons.push('request_timeout_over_policy');
  }
  if (maxDailyCalls < 1 || maxDailyCalls > MAX_POLICY_DAILY_CALLS) {
    blockingReasons.push('daily_call_limit_invalid');
  }
  if (maxConcurrency < 1 || maxConcurrency > MAX_POLICY_CONCURRENCY) {
    blockingReasons.push('concurrency_limit_invalid');
  }
  if (maxRetries < 0 || maxRetries > MAX_POLICY_RETRIES) {
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
    schema: LLM_LIVE_PROVIDER_POLICY_SCHEMA,
    provider: runtimeConfig.provider,
    model: runtimeConfig.model,
    requestTimeoutMs: runtimeConfig.requestTimeoutMs || DEFAULT_LLM_REQUEST_TIMEOUT_MS,
    policyAccepted,
    runtimeReadyForLiveSummary: runtimeReport.readyForLiveSummary,
    runtimeBlockingReasons: runtimeReport.blockingReasons,
    publicSensitiveEnvNames: runtimeReport.publicSensitiveEnvNames,
    limits: {
      maxDailyCalls,
      maxConcurrency,
      maxRetries,
      maxRequestTimeoutMs: MAX_POLICY_TIMEOUT_MS,
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
    readyForProductionLiveProvider: blockingReasons.length === 0,
    blockingReasons,
    provider_call: false,
    production_changed: false,
    keyPersisted: false,
  };
}

export function listLiveProviderPolicyEnvNames(): string[] {
  return [
    LLM_LIVE_POLICY_ACCEPTED_ENV,
    LLM_LIVE_MAX_DAILY_CALLS_ENV,
    LLM_LIVE_MAX_CONCURRENCY_ENV,
    LLM_LIVE_MAX_RETRIES_ENV,
    LLM_LIVE_SOURCE_RETENTION_ENV,
    LLM_LIVE_EVIDENCE_LEVEL_ENV,
    LLM_LIVE_ROLLBACK_MODE_ENV,
    LLM_LIVE_OBSERVABILITY_ENV,
  ];
}

function normalizeBoundedInteger(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}
