export const ARTICLE_SUMMARY_CLIENT_MAX_CONTENT_CHARS = 12_000;

export interface ArticleSummarySource {
  title: string;
  url: string;
  html?: string;
  digest?: string;
}

export interface ArticleSummaryPayload {
  title: string;
  summary: string;
  key_points: string[];
  tags: string[];
  caveat: string;
}

export type ArticleSummaryApiResult =
  | {
      ok: false;
      code: string;
      mode: 'disabled' | 'mock' | 'live';
      provider: 'kimi' | 'deepseek';
      model: string;
      providerCallAttempted: boolean;
    }
  | {
      ok: true;
      mode: 'mock' | 'live';
      provider: 'kimi' | 'deepseek';
      model: string;
      providerCallAttempted: boolean;
      summary: ArticleSummaryPayload;
    };

export interface ArticleSummaryRequestInput {
  title: string;
  url: string;
  content: string;
}

export function normalizeArticleSummaryPlainText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, ARTICLE_SUMMARY_CLIENT_MAX_CONTENT_CHARS);
}

export function extractArticleSummaryTextFromHtml(html: string): string {
  if (!html.trim()) {
    return '';
  }

  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script, style, noscript').forEach(node => node.remove());
    const preferredContent =
      doc.querySelector('#js_content')?.textContent ||
      doc.querySelector('#js_article')?.textContent ||
      doc.body?.textContent ||
      '';
    return normalizeArticleSummaryPlainText(preferredContent);
  }

  return normalizeArticleSummaryPlainText(
    decodeHtmlEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
    )
  );
}

export function createArticleSummaryRequestInput(source: ArticleSummarySource): ArticleSummaryRequestInput {
  const contentFromHtml = source.html ? extractArticleSummaryTextFromHtml(source.html) : '';
  const fallbackContent = normalizeArticleSummaryPlainText(source.digest || '');
  return {
    title: normalizeArticleSummaryPlainText(source.title || 'Untitled Article').slice(0, 200),
    url: normalizeArticleSummaryPlainText(source.url || ''),
    content: contentFromHtml || fallbackContent,
  };
}

export function useArticleSummary() {
  const loading = shallowRef(false);
  const result = shallowRef<ArticleSummaryApiResult | null>(null);
  const issue = shallowRef('');

  const summary = computed(() => (result.value?.ok ? result.value.summary : null));
  const providerCallAttempted = computed(() => result.value?.providerCallAttempted === true);
  const statusCode = computed(() => (!result.value?.ok ? result.value?.code || '' : ''));
  const mode = computed(() => result.value?.mode || '');
  const provider = computed(() => result.value?.provider || 'deepseek');
  const model = computed(() => result.value?.model || '');

  function clear() {
    result.value = null;
    issue.value = '';
  }

  async function summarize(source: ArticleSummarySource) {
    const body = createArticleSummaryRequestInput(source);
    if (!body.content) {
      result.value = null;
      issue.value = '当前文章没有可用于摘要的正文内容。';
      return null;
    }

    loading.value = true;
    issue.value = '';
    try {
      const response = await fetch('/api/web/llm/article-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await response.json()) as ArticleSummaryApiResult;
      result.value = data;
      if (!data.ok) {
        issue.value = summaryIssueFromCode(data.code);
      }
      return data;
    } catch {
      result.value = null;
      issue.value = '摘要请求未完成，请稍后重试。';
      return null;
    } finally {
      loading.value = false;
    }
  }

  return {
    loading,
    result,
    summary,
    issue,
    mode,
    provider,
    model,
    statusCode,
    providerCallAttempted,
    clear,
    summarize,
  };
}

function summaryIssueFromCode(code: string): string {
  if (code === 'LLM_ARTICLE_SUMMARY_DISABLED') {
    return '摘要能力当前保持 disabled。切换为 mock 后可本地预览，不会调用 provider。';
  }
  if (code === 'LLM_ARTICLE_SUMMARY_EMPTY_CONTENT') {
    return '当前文章没有可用于摘要的正文内容。';
  }
  if (code === 'LLM_PROVIDER_CALL_NOT_AUTHORIZED') {
    return 'live 模式未授权，当前不会调用 provider。';
  }
  if (code === 'LLM_DISABLED') {
    return 'LLM adapter 当前未启用。';
  }
  if (code === 'LLM_API_KEY_MISSING') {
    return '服务端未配置 provider key。';
  }
  return '摘要请求未完成，请检查当前环境配置。';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
