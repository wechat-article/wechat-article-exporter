import { runArticleSummary, type ArticleSummaryInput } from '~/server/utils/llm-article-summary';

export default defineEventHandler(async event => {
  const body = await readBody<ArticleSummaryInput>(event);
  const result = await runArticleSummary(body || {});

  if (!result.ok) {
    const status =
      result.code === 'LLM_ARTICLE_SUMMARY_EMPTY_CONTENT'
        ? 400
        : result.code === 'LLM_ARTICLE_SUMMARY_DISABLED'
          ? 404
          : 503;
    setResponseStatus(event, status);
  }

  return result;
});
