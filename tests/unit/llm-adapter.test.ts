import { describe, expect, it, vi } from 'vitest';
import {
  buildOpenAiCompatibleChatRequest,
  isLlmEnabled,
  normalizeLlmProvider,
  resolveLlmRuntimeConfig,
  runLlmChat,
} from '~/server/utils/llm-adapter';

const prompt = {
  messages: [{ role: 'user' as const, content: 'Summarize this article.' }],
};

describe('llm-adapter', () => {
  it('is disabled unless explicitly enabled', async () => {
    const fetchMock = vi.fn();
    expect(isLlmEnabled({})).toBe(false);

    const result = await runLlmChat(prompt, { env: {}, fetchImpl: fetchMock });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_DISABLED',
      providerCallAttempted: false,
      provider: 'deepseek',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts only supported runtime providers', () => {
    expect(normalizeLlmProvider(undefined)).toBe('deepseek');
    expect(normalizeLlmProvider('kimi')).toBe('kimi');
    expect(normalizeLlmProvider('deepseek')).toBe('deepseek');
    expect(normalizeLlmProvider('openai')).toBeNull();
    expect(normalizeLlmProvider('kimi-code')).toBeNull();
  });

  it('does not call fetch when the selected key is missing', async () => {
    const fetchMock = vi.fn();

    const result = await runLlmChat(prompt, {
      env: {
        NUXT_LLM_ENABLED: 'true',
        NUXT_LLM_PROVIDER: 'deepseek',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_API_KEY_MISSING',
      providerCallAttempted: false,
      provider: 'deepseek',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not call fetch without explicit provider-call authorization', async () => {
    const fetchMock = vi.fn();

    const result = await runLlmChat(prompt, {
      env: {
        NUXT_LLM_ENABLED: 'true',
        NUXT_LLM_PROVIDER: 'kimi',
        NUXT_LLM_KIMI_API_KEY: 'test-kimi-key',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_PROVIDER_CALL_NOT_AUTHORIZED',
      providerCallAttempted: false,
      provider: 'kimi',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('builds a redacted Kimi OpenAI-compatible request shape', () => {
    const config = resolveLlmRuntimeConfig({
      NUXT_LLM_ENABLED: 'true',
      NUXT_LLM_PROVIDER: 'kimi',
      NUXT_LLM_KIMI_API_KEY: 'test-kimi-key',
      NUXT_LLM_KIMI_MODEL: 'kimi-k2.6',
    });

    const request = buildOpenAiCompatibleChatRequest(config, {
      ...prompt,
      responseFormat: 'json_object',
    });

    expect(request.url).toBe('https://api.moonshot.ai/v1/chat/completions');
    expect(request.redacted).toEqual({
      provider: 'kimi',
      model: 'kimi-k2.6',
      baseUrl: 'https://api.moonshot.ai/v1',
      apiKeyEnvName: 'NUXT_LLM_KIMI_API_KEY',
    });
    expect(request.init.headers).toMatchObject({
      Authorization: 'Bearer test-kimi-key',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(request.init.body as string)).toMatchObject({
      model: 'kimi-k2.6',
      stream: false,
      response_format: { type: 'json_object' },
    });
  });

  it('builds a DeepSeek request shape with env overrides', () => {
    const config = resolveLlmRuntimeConfig({
      NUXT_LLM_ENABLED: 'true',
      NUXT_LLM_PROVIDER: 'deepseek',
      DEEPSEEK_API_KEY: 'test-deepseek-key',
      NUXT_LLM_DEEPSEEK_BASE_URL: 'https://api.deepseek.com/',
      NUXT_LLM_DEEPSEEK_MODEL: 'deepseek-v4-pro',
    });

    const request = buildOpenAiCompatibleChatRequest(config, {
      ...prompt,
      temperature: 0.2,
      maxTokens: 512,
      thinking: 'disabled',
      reasoningEffort: 'high',
    });

    expect(request.url).toBe('https://api.deepseek.com/chat/completions');
    expect(request.redacted).toEqual({
      provider: 'deepseek',
      model: 'deepseek-v4-pro',
      baseUrl: 'https://api.deepseek.com',
      apiKeyEnvName: 'DEEPSEEK_API_KEY',
    });
    expect(JSON.parse(request.init.body as string)).toMatchObject({
      model: 'deepseek-v4-pro',
      temperature: 0.2,
      max_tokens: 512,
      thinking: { type: 'disabled' },
      reasoning_effort: 'high',
      stream: false,
    });
  });

  it('attaches a timeout signal to authorized provider calls', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '{"summary":"ok"}' } }] }),
    } as Response);

    const result = await runLlmChat(prompt, {
      env: {
        NUXT_LLM_ENABLED: 'true',
        NUXT_LLM_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
        NUXT_LLM_REQUEST_TIMEOUT_MS: '1500',
      },
      allowProviderCall: true,
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: true,
      providerCallAttempted: true,
      provider: 'deepseek',
      status: 200,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
