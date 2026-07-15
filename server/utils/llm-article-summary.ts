import { resolveLlmRuntimeConfig, runLlmChat, type LlmEnv, type LlmProvider } from './llm-adapter';

export const LLM_ARTICLE_SUMMARY_MODE_ENV = 'NUXT_LLM_ARTICLE_SUMMARY_MODE';
export const LLM_PROVIDER_CALL_AUTHORIZED_ENV = 'NUXT_LLM_PROVIDER_CALL_AUTHORIZED';
export const ARTICLE_SUMMARY_MAX_CONTENT_CHARS = 12_000;

export type ArticleSummaryMode = 'disabled' | 'mock' | 'live';

export interface ArticleSummaryInput {
  title?: string;
  url?: string;
  content?: string;
}

export interface ArticleSummaryPayload {
  title: string;
  summary: string;
  key_points: string[];
  tags: string[];
  caveat: string;
}

export type ArticleSummaryResult =
  | {
      ok: false;
      code:
        | 'LLM_ARTICLE_SUMMARY_DISABLED'
        | 'LLM_ARTICLE_SUMMARY_EMPTY_CONTENT'
        | 'LLM_PROVIDER_CALL_NOT_AUTHORIZED'
        | 'LLM_DISABLED'
        | 'LLM_UNSUPPORTED_PROVIDER'
        | 'LLM_API_KEY_MISSING'
        | 'LLM_PROVIDER_REQUEST_NOT_OK'
        | 'LLM_PROVIDER_RESPONSE_INVALID';
      mode: ArticleSummaryMode;
      provider: LlmProvider;
      model: string;
      providerCallAttempted: boolean;
    }
  | {
      ok: true;
      mode: 'mock' | 'live';
      provider: LlmProvider;
      model: string;
      providerCallAttempted: boolean;
      summary: ArticleSummaryPayload;
    };

export interface RunArticleSummaryOptions {
  env?: LlmEnv;
  fetchImpl?: typeof fetch;
}

export function normalizeArticleSummaryMode(value: string | undefined): ArticleSummaryMode {
  if (value === 'mock' || value === 'live') {
    return value;
  }
  return 'disabled';
}

export async function runArticleSummary(
  input: ArticleSummaryInput,
  options: RunArticleSummaryOptions = {}
): Promise<ArticleSummaryResult> {
  const env = options.env || process.env;
  const mode = normalizeArticleSummaryMode(env[LLM_ARTICLE_SUMMARY_MODE_ENV]);
  const config = resolveLlmRuntimeConfig(env);
  const normalizedInput = normalizeArticleSummaryInput(input);

  if (!normalizedInput.content) {
    return {
      ok: false,
      code: 'LLM_ARTICLE_SUMMARY_EMPTY_CONTENT',
      mode,
      provider: config.provider,
      model: config.model,
      providerCallAttempted: false,
    };
  }

  if (mode === 'disabled') {
    return {
      ok: false,
      code: 'LLM_ARTICLE_SUMMARY_DISABLED',
      mode,
      provider: config.provider,
      model: config.model,
      providerCallAttempted: false,
    };
  }

  if (mode === 'mock') {
    return {
      ok: true,
      mode,
      provider: config.provider,
      model: config.model,
      providerCallAttempted: false,
      summary: buildMockArticleSummary(normalizedInput),
    };
  }

  const llmResult = await runLlmChat(buildArticleSummaryPrompt(normalizedInput), {
    env,
    fetchImpl: options.fetchImpl,
    allowProviderCall: env[LLM_PROVIDER_CALL_AUTHORIZED_ENV] === 'true',
  });
  if (!llmResult.ok) {
    if (llmResult.providerCallAttempted) {
      return {
        ok: false,
        code: 'LLM_PROVIDER_REQUEST_NOT_OK',
        mode,
        provider: llmResult.provider,
        model: llmResult.model,
        providerCallAttempted: true,
      };
    }
    return {
      ok: false,
      code: llmResult.code,
      mode,
      provider: llmResult.provider,
      model: llmResult.model,
      providerCallAttempted: false,
    };
  }

  const summary = parseProviderSummary(llmResult.body, normalizedInput.title);
  if (!summary) {
    return {
      ok: false,
      code: 'LLM_PROVIDER_RESPONSE_INVALID',
      mode,
      provider: llmResult.provider,
      model: llmResult.model,
      providerCallAttempted: true,
    };
  }

  return {
    ok: true,
    mode,
    provider: llmResult.provider,
    model: llmResult.model,
    providerCallAttempted: true,
    summary,
  };
}

export function normalizeArticleSummaryInput(input: ArticleSummaryInput): Required<ArticleSummaryInput> {
  return {
    title: normalizeWhitespace(input.title || 'Untitled Article').slice(0, 200),
    url: normalizeWhitespace(input.url || ''),
    content: normalizeWhitespace(input.content || '').slice(0, ARTICLE_SUMMARY_MAX_CONTENT_CHARS),
  };
}

export function buildArticleSummaryPrompt(input: Required<ArticleSummaryInput>) {
  return {
    responseFormat: 'json_object' as const,
    thinking: 'disabled' as const,
    temperature: 0.2,
    maxTokens: 900,
    messages: [
      {
        role: 'system' as const,
        content:
          'You are WCPT article summarizer. Return strict JSON with fields: title, summary, key_points, tags, caveat. Keep Chinese output concise and factual.',
      },
      {
        role: 'user' as const,
        content: JSON.stringify({
          title: input.title,
          url: input.url,
          content: input.content,
        }),
      },
    ],
  };
}

function buildMockArticleSummary(input: Required<ArticleSummaryInput>): ArticleSummaryPayload {
  const sentences = splitSentences(input.content);
  const keyPoints = sentences.slice(0, 3);
  const summary = keyPoints.length > 0 ? keyPoints.join(' ') : input.content.slice(0, 180);
  return {
    title: input.title,
    summary: summary || '暂无可摘要内容。',
    key_points: keyPoints.length > 0 ? keyPoints : ['暂无明确要点。'],
    tags: inferMockTags(input),
    caveat: 'Mock summary generated locally; no provider call was made.',
  };
}

function inferMockTags(input: Required<ArticleSummaryInput>): string[] {
  const text = `${input.title} ${input.content}`.toLowerCase();
  const tags = new Set<string>();
  if (text.includes('ai') || text.includes('大模型') || text.includes('deepseek')) tags.add('AI');
  if (text.includes('微信') || text.includes('公众号')) tags.add('WeChat');
  if (text.includes('导出') || text.includes('归档')) tags.add('Export');
  if (text.includes('部署') || text.includes('腾讯云')) tags.add('Deployment');
  if (tags.size === 0) tags.add('Article');
  return Array.from(tags).slice(0, 5);
}

function splitSentences(content: string): string[] {
  return content
    .split(/(?<=[。！？.!?])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function parseProviderSummary(body: unknown, fallbackTitle: string): ArticleSummaryPayload | null {
  const content = extractProviderText(body);
  if (!content) {
    return null;
  }
  try {
    const parsed = JSON.parse(content) as Partial<ArticleSummaryPayload>;
    return {
      title: normalizeWhitespace(parsed.title || fallbackTitle),
      summary: normalizeWhitespace(parsed.summary || ''),
      key_points: normalizeStringArray(parsed.key_points),
      tags: normalizeStringArray(parsed.tags),
      caveat: normalizeWhitespace(parsed.caveat || 'Generated by configured LLM provider.'),
    };
  } catch {
    return {
      title: fallbackTitle,
      summary: normalizeWhitespace(content),
      key_points: [],
      tags: [],
      caveat: 'Generated by configured LLM provider; response was not valid JSON.',
    };
  }
}

function extractProviderText(body: unknown): string {
  if (!body || typeof body !== 'object') {
    return '';
  }
  const choices = (body as { choices?: Array<{ message?: { content?: unknown } }> }).choices;
  const content = choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === 'string')
        .map(item => normalizeWhitespace(item))
        .filter(Boolean)
        .slice(0, 8)
    : [];
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
