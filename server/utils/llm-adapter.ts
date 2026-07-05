export const LLM_ENABLED_ENV = 'NUXT_LLM_ENABLED';
export const LLM_PROVIDER_ENV = 'NUXT_LLM_PROVIDER';
export const LLM_REQUEST_TIMEOUT_MS_ENV = 'NUXT_LLM_REQUEST_TIMEOUT_MS';
export const DEFAULT_LLM_PROVIDER: LlmProvider = 'deepseek';
export const DEFAULT_LLM_REQUEST_TIMEOUT_MS = 30_000;

export type LlmProvider = 'kimi' | 'deepseek';
export type LlmEnv = Record<string, string | undefined>;

export interface LlmProviderDefinition {
  id: LlmProvider;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  apiKeyEnvNames: string[];
  baseUrlEnvName: string;
  modelEnvName: string;
}

export interface LlmRuntimeConfig {
  enabled: boolean;
  provider: LlmProvider;
  label: string;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
  apiKey?: string;
  apiKeyEnvName?: string;
  ready: boolean;
  disabledReason?: 'disabled' | 'unsupported_provider' | 'missing_api_key';
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmChatInput {
  messages: LlmMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json_object';
  thinking?: 'enabled' | 'disabled';
  reasoningEffort?: 'high' | 'max';
}

export interface LlmRequestShape {
  url: string;
  init: RequestInit;
  redacted: {
    provider: LlmProvider;
    model: string;
    baseUrl: string;
    apiKeyEnvName: string;
  };
}

export interface RunLlmChatOptions {
  env?: LlmEnv;
  allowProviderCall?: boolean;
  fetchImpl?: typeof fetch;
}

export type RunLlmChatResult =
  | {
      ok: false;
      code: 'LLM_DISABLED' | 'LLM_UNSUPPORTED_PROVIDER' | 'LLM_API_KEY_MISSING' | 'LLM_PROVIDER_CALL_NOT_AUTHORIZED';
      providerCallAttempted: false;
      provider: LlmProvider;
      model: string;
    }
  | {
      ok: boolean;
      providerCallAttempted: true;
      provider: LlmProvider;
      model: string;
      status: number;
      body: unknown;
    };

export const LLM_PROVIDER_DEFINITIONS: Record<LlmProvider, LlmProviderDefinition> = {
  kimi: {
    id: 'kimi',
    label: 'Kimi / Moonshot',
    defaultBaseUrl: 'https://api.moonshot.ai/v1',
    defaultModel: 'kimi-k2.6',
    apiKeyEnvNames: ['NUXT_LLM_KIMI_API_KEY', 'KIMI_API_KEY', 'MOONSHOT_API_KEY'],
    baseUrlEnvName: 'NUXT_LLM_KIMI_BASE_URL',
    modelEnvName: 'NUXT_LLM_KIMI_MODEL',
  },
  deepseek: {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-v4-flash',
    apiKeyEnvNames: ['NUXT_LLM_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY'],
    baseUrlEnvName: 'NUXT_LLM_DEEPSEEK_BASE_URL',
    modelEnvName: 'NUXT_LLM_DEEPSEEK_MODEL',
  },
};

export function isLlmEnabled(env: LlmEnv = process.env): boolean {
  return env[LLM_ENABLED_ENV] === 'true';
}

export function normalizeLlmProvider(value: string | undefined): LlmProvider | null {
  if (value === 'kimi' || value === 'deepseek') {
    return value;
  }
  if (!value) {
    return DEFAULT_LLM_PROVIDER;
  }
  return null;
}

export function resolveLlmRuntimeConfig(env: LlmEnv = process.env): LlmRuntimeConfig {
  const provider = normalizeLlmProvider(env[LLM_PROVIDER_ENV]);
  const fallbackProvider: LlmProvider = provider || DEFAULT_LLM_PROVIDER;
  const definition = LLM_PROVIDER_DEFINITIONS[fallbackProvider];
  const baseConfig = {
    enabled: isLlmEnabled(env),
    provider: fallbackProvider,
    label: definition.label,
    baseUrl: trimTrailingSlash(env[definition.baseUrlEnvName] || definition.defaultBaseUrl),
    model: env[definition.modelEnvName] || definition.defaultModel,
    requestTimeoutMs: normalizeRequestTimeoutMs(env[LLM_REQUEST_TIMEOUT_MS_ENV]),
  };

  if (!provider) {
    return {
      ...baseConfig,
      ready: false,
      disabledReason: 'unsupported_provider',
    };
  }

  if (!baseConfig.enabled) {
    return {
      ...baseConfig,
      ready: false,
      disabledReason: 'disabled',
    };
  }

  const keyEnvName = definition.apiKeyEnvNames.find(name => Boolean(env[name]));
  if (!keyEnvName) {
    return {
      ...baseConfig,
      ready: false,
      disabledReason: 'missing_api_key',
    };
  }

  return {
    ...baseConfig,
    apiKey: env[keyEnvName],
    apiKeyEnvName: keyEnvName,
    ready: true,
  };
}

export function buildOpenAiCompatibleChatRequest(config: LlmRuntimeConfig, input: LlmChatInput): LlmRequestShape {
  if (!config.ready || !config.apiKey || !config.apiKeyEnvName) {
    throw new TypeError('LLM runtime config is not ready');
  }
  const body: Record<string, unknown> = {
    model: config.model,
    messages: input.messages,
    stream: false,
  };
  if (typeof input.temperature === 'number') {
    body.temperature = input.temperature;
  }
  if (typeof input.maxTokens === 'number') {
    body.max_tokens = input.maxTokens;
  }
  if (input.responseFormat === 'json_object') {
    body.response_format = { type: 'json_object' };
  }
  if (config.provider === 'deepseek' && input.thinking) {
    body.thinking = { type: input.thinking };
  }
  if (config.provider === 'deepseek' && input.reasoningEffort) {
    body.reasoning_effort = input.reasoningEffort;
  }

  return {
    url: `${config.baseUrl}/chat/completions`,
    init: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    redacted: {
      provider: config.provider,
      model: config.model,
      baseUrl: config.baseUrl,
      apiKeyEnvName: config.apiKeyEnvName,
    },
  };
}

export async function runLlmChat(input: LlmChatInput, options: RunLlmChatOptions = {}): Promise<RunLlmChatResult> {
  const config = resolveLlmRuntimeConfig(options.env || process.env);
  if (!config.ready) {
    return disabledRunResult(config);
  }
  if (options.allowProviderCall !== true) {
    return {
      ok: false,
      code: 'LLM_PROVIDER_CALL_NOT_AUTHORIZED',
      providerCallAttempted: false,
      provider: config.provider,
      model: config.model,
    };
  }

  const request = buildOpenAiCompatibleChatRequest(config, input);
  const abort = createRequestAbort(config.requestTimeoutMs);
  try {
    const response = await (options.fetchImpl || fetch)(request.url, {
      ...request.init,
      signal: abort.signal,
    });
    const body = await response.json().catch(() => null);
    return {
      ok: response.ok,
      providerCallAttempted: true,
      provider: config.provider,
      model: config.model,
      status: response.status,
      body,
    };
  } catch {
    return {
      ok: false,
      providerCallAttempted: true,
      provider: config.provider,
      model: config.model,
      status: 0,
      body: { code: 'LLM_PROVIDER_FETCH_REJECTED' },
    };
  } finally {
    abort.clear();
  }
}

function disabledRunResult(config: LlmRuntimeConfig): RunLlmChatResult {
  const code =
    config.disabledReason === 'unsupported_provider'
      ? 'LLM_UNSUPPORTED_PROVIDER'
      : config.disabledReason === 'missing_api_key'
        ? 'LLM_API_KEY_MISSING'
        : 'LLM_DISABLED';
  return {
    ok: false,
    code,
    providerCallAttempted: false,
    provider: config.provider,
    model: config.model,
  };
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeRequestTimeoutMs(value: string | undefined): number {
  if (!value) {
    return DEFAULT_LLM_REQUEST_TIMEOUT_MS;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1_000) {
    return DEFAULT_LLM_REQUEST_TIMEOUT_MS;
  }
  return Math.min(parsed, 120_000);
}

function createRequestAbort(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  if (typeof timer === 'object' && typeof timer.unref === 'function') {
    timer.unref();
  }
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  };
}
