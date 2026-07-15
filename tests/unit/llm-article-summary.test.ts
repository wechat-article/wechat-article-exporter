import { describe, expect, it, vi } from 'vitest';
import {
  ARTICLE_SUMMARY_MAX_CONTENT_CHARS,
  buildArticleSummaryPrompt,
  normalizeArticleSummaryInput,
  normalizeArticleSummaryMode,
  runArticleSummary,
} from '~/server/utils/llm-article-summary';

const article = {
  title: 'DeepSeek 摘要测试',
  url: 'https://mp.weixin.qq.com/s/local-summary-smoke',
  content: '第一段介绍微信公众号文章归档。第二段介绍 DeepSeek 摘要能力。第三段介绍本地 mock gate 不调用 provider。',
};

describe('llm-article-summary', () => {
  it('defaults to disabled and does not call fetch', async () => {
    const fetchMock = vi.fn();

    const result = await runArticleSummary(article, { env: {}, fetchImpl: fetchMock });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_ARTICLE_SUMMARY_DISABLED',
      mode: 'disabled',
      provider: 'deepseek',
      providerCallAttempted: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns a deterministic mock summary without provider call', async () => {
    const fetchMock = vi.fn();

    const result = await runArticleSummary(article, {
      env: {
        NUXT_LLM_ARTICLE_SUMMARY_MODE: 'mock',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: true,
      mode: 'mock',
      provider: 'deepseek',
      providerCallAttempted: false,
      summary: {
        title: article.title,
        tags: expect.arrayContaining(['AI', 'WeChat']),
      },
    });
    expect(result.ok && result.summary.summary).toContain('DeepSeek 摘要能力');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('bounds input content before prompt construction', () => {
    const input = normalizeArticleSummaryInput({
      title: '  title   with   spaces  ',
      content: 'x'.repeat(ARTICLE_SUMMARY_MAX_CONTENT_CHARS + 100),
    });

    expect(input.title).toBe('title with spaces');
    expect(input.content).toHaveLength(ARTICLE_SUMMARY_MAX_CONTENT_CHARS);

    const prompt = buildArticleSummaryPrompt(input);
    expect(prompt.responseFormat).toBe('json_object');
    expect(prompt.thinking).toBe('disabled');
    expect(prompt.messages[1].content).toContain('"title":"title with spaces"');
  });

  it('blocks live mode without explicit provider-call authorization', async () => {
    const fetchMock = vi.fn();

    const result = await runArticleSummary(article, {
      env: {
        NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
        NUXT_LLM_ENABLED: 'true',
        NUXT_LLM_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_PROVIDER_CALL_NOT_AUTHORIZED',
      mode: 'live',
      provider: 'deepseek',
      providerCallAttempted: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('marks a live provider attempt when an authorized upstream response is not usable', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ message: 'rate limited' }),
    } as Response);

    const result = await runArticleSummary(article, {
      env: {
        NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
        NUXT_LLM_PROVIDER_CALL_AUTHORIZED: 'true',
        NUXT_LLM_ENABLED: 'true',
        NUXT_LLM_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_PROVIDER_REQUEST_NOT_OK',
      mode: 'live',
      provider: 'deepseek',
      providerCallAttempted: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('marks a live provider attempt when an authorized response body cannot become a summary', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: '' } }] }),
    } as Response);

    const result = await runArticleSummary(article, {
      env: {
        NUXT_LLM_ARTICLE_SUMMARY_MODE: 'live',
        NUXT_LLM_PROVIDER_CALL_AUTHORIZED: 'true',
        NUXT_LLM_ENABLED: 'true',
        NUXT_LLM_PROVIDER: 'deepseek',
        DEEPSEEK_API_KEY: 'test-deepseek-key',
      },
      fetchImpl: fetchMock,
    });

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_PROVIDER_RESPONSE_INVALID',
      mode: 'live',
      provider: 'deepseek',
      providerCallAttempted: true,
    });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('rejects empty content before any provider path', async () => {
    const fetchMock = vi.fn();

    const result = await runArticleSummary(
      { title: 'empty', content: '   ' },
      {
        env: {
          NUXT_LLM_ARTICLE_SUMMARY_MODE: 'mock',
        },
        fetchImpl: fetchMock,
      }
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'LLM_ARTICLE_SUMMARY_EMPTY_CONTENT',
      providerCallAttempted: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('normalizes unknown modes to disabled', () => {
    expect(normalizeArticleSummaryMode(undefined)).toBe('disabled');
    expect(normalizeArticleSummaryMode('mock')).toBe('mock');
    expect(normalizeArticleSummaryMode('live')).toBe('live');
    expect(normalizeArticleSummaryMode('provider')).toBe('disabled');
  });
});
