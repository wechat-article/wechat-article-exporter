import {
  DEFAULT_LLM_PROVIDER,
  LLM_ENABLED_ENV,
  LLM_PROVIDER_DEFINITIONS,
  LLM_PROVIDER_ENV,
  LLM_REQUEST_TIMEOUT_MS_ENV,
  normalizeLlmProvider,
  resolveLlmRuntimeConfig,
  type LlmEnv,
  type LlmProvider,
} from './llm-adapter';
import { LLM_ARTICLE_SUMMARY_MODE_ENV, LLM_PROVIDER_CALL_AUTHORIZED_ENV } from './llm-article-summary';

export const LLM_RUNTIME_PROVISIONING_PREFLIGHT_SCHEMA = 'wcpt.llm_runtime_provisioning.v1';

export type LlmRuntimeProvisioningBlockCode =
  | 'public_sensitive_env_present'
  | 'llm_disabled'
  | 'unsupported_provider'
  | 'runtime_key_missing'
  | 'summary_mode_not_live'
  | 'provider_call_not_authorized';

export interface LlmRuntimeProvisioningReport {
  schema: typeof LLM_RUNTIME_PROVISIONING_PREFLIGHT_SCHEMA;
  provider: LlmProvider;
  model: string;
  baseUrl: string;
  requestTimeoutMs: number;
  llmEnabled: boolean;
  summaryMode: string;
  providerCallAuthorized: boolean;
  runtimeKeyPresent: boolean;
  runtimeKeyEnvName?: string;
  publicSensitiveEnvNames: string[];
  readyForLiveSummary: boolean;
  blockingReasons: LlmRuntimeProvisioningBlockCode[];
  provider_call: false;
  production_changed: false;
  keyPersisted: false;
}

export function createLlmRuntimeProvisioningReport(env: LlmEnv = process.env): LlmRuntimeProvisioningReport {
  const normalizedProvider = normalizeLlmProvider(env[LLM_PROVIDER_ENV]);
  const provider = normalizedProvider || DEFAULT_LLM_PROVIDER;
  const definition = LLM_PROVIDER_DEFINITIONS[provider];
  const config = resolveLlmRuntimeConfig(env);
  const runtimeKeyEnvName = definition.apiKeyEnvNames.find(name => Boolean(env[name]));
  const publicSensitiveEnvNames = findPublicSensitiveEnvNames(env);
  const summaryMode = env[LLM_ARTICLE_SUMMARY_MODE_ENV] || 'disabled';
  const providerCallAuthorized = env[LLM_PROVIDER_CALL_AUTHORIZED_ENV] === 'true';
  const blockingReasons: LlmRuntimeProvisioningBlockCode[] = [];

  if (publicSensitiveEnvNames.length > 0) {
    blockingReasons.push('public_sensitive_env_present');
  }
  if (!normalizedProvider) {
    blockingReasons.push('unsupported_provider');
  }
  if (env[LLM_ENABLED_ENV] !== 'true') {
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
    schema: LLM_RUNTIME_PROVISIONING_PREFLIGHT_SCHEMA,
    provider,
    model: config.model,
    baseUrl: config.baseUrl,
    requestTimeoutMs: config.requestTimeoutMs,
    llmEnabled: env[LLM_ENABLED_ENV] === 'true',
    summaryMode,
    providerCallAuthorized,
    runtimeKeyPresent: Boolean(runtimeKeyEnvName),
    runtimeKeyEnvName,
    publicSensitiveEnvNames,
    readyForLiveSummary: blockingReasons.length === 0,
    blockingReasons,
    provider_call: false,
    production_changed: false,
    keyPersisted: false,
  };
}

export function findPublicSensitiveEnvNames(env: LlmEnv = process.env): string[] {
  return Object.keys(env)
    .filter(name => name.startsWith('NUXT_PUBLIC_'))
    .filter(name => /(?:LLM|DEEPSEEK|KIMI|MOONSHOT|OPENAI|API_?KEY|TOKEN|SECRET|PASSWORD|PRIVATE)/i.test(name))
    .filter(name => Boolean(env[name]))
    .sort();
}

export function listServerOnlyLlmEnvNames(): string[] {
  return [
    LLM_ENABLED_ENV,
    LLM_PROVIDER_ENV,
    LLM_REQUEST_TIMEOUT_MS_ENV,
    LLM_ARTICLE_SUMMARY_MODE_ENV,
    LLM_PROVIDER_CALL_AUTHORIZED_ENV,
    'NUXT_LLM_LIVE_POLICY_ACCEPTED',
    'NUXT_LLM_LIVE_MAX_DAILY_CALLS',
    'NUXT_LLM_LIVE_MAX_CONCURRENCY',
    'NUXT_LLM_LIVE_MAX_RETRIES',
    'NUXT_LLM_LIVE_SOURCE_RETENTION',
    'NUXT_LLM_LIVE_EVIDENCE_LEVEL',
    'NUXT_LLM_LIVE_ROLLBACK_MODE',
    'NUXT_LLM_LIVE_OBSERVABILITY',
    ...Object.values(LLM_PROVIDER_DEFINITIONS).flatMap(definition => [
      ...definition.apiKeyEnvNames.filter(name => name.startsWith('NUXT_LLM_')),
      definition.baseUrlEnvName,
      definition.modelEnvName,
    ]),
  ];
}
