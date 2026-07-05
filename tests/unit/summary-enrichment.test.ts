import { describe, expect, it } from 'vitest';
import {
  createSummaryEnrichmentAudit,
  createSummaryEnrichmentPayload,
  normalizeSummaryEnrichmentText,
  SUMMARY_ENRICHMENT_SCHEMA_VERSION,
  type SummaryEnrichmentInput,
} from '~/utils/download/exporter/summaryEnrichment';

function createInput(overrides: Partial<SummaryEnrichmentInput> = {}): SummaryEnrichmentInput {
  const base: SummaryEnrichmentInput = {
    article: {
      title: 'WCPT Article',
      url: 'https://mp.weixin.qq.com/s/example',
    },
    summary: {
      text: '人工复核后的摘要。',
      keyPoints: ['归档公众号文章', '同源摘要链路'],
      tags: ['公众号', '摘要'],
      caveat: 'LLM output reviewed by human.',
    },
    review: {
      state: 'accepted_for_export',
      source: 'single_article_panel',
      reviewedAt: '2026-07-04T09:12:00+08:00',
      reviewer: 'local-user',
    },
    runtime: {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      mode: 'live',
      providerCall: true,
      productionChanged: false,
    },
    exportGate: {
      writeAllowed: true,
      reason: 'manual export schema gate',
    },
  };

  return {
    ...base,
    ...overrides,
    article: { ...base.article, ...overrides.article },
    summary: { ...base.summary, ...overrides.summary },
    review: { ...base.review, ...overrides.review },
    runtime: { ...base.runtime, ...overrides.runtime },
    exportGate: { ...base.exportGate, ...overrides.exportGate },
  };
}

describe('summary export enrichment schema', () => {
  it('blocks rejected drafts with an audit trail', () => {
    const result = createSummaryEnrichmentPayload(
      createInput({
        review: { state: 'rejected' },
      })
    );

    expect(result).toMatchObject({
      ok: false,
      code: 'SUMMARY_NOT_ACCEPTED_FOR_EXPORT',
      audit: {
        schema: SUMMARY_ENRICHMENT_SCHEMA_VERSION,
        review_state: 'rejected',
        provider_call: true,
        production_changed: false,
      },
    });
  });

  it('keeps accepted_for_session out of durable export payloads even when a gate is open', () => {
    const result = createSummaryEnrichmentPayload(
      createInput({
        review: { state: 'accepted_for_session' },
        exportGate: { writeAllowed: true },
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('SUMMARY_NOT_ACCEPTED_FOR_EXPORT');
      expect(result.audit.export_write_allowed).toBe(true);
    }
  });

  it('blocks accepted export summaries when the export gate is closed', () => {
    const result = createSummaryEnrichmentPayload(
      createInput({
        exportGate: {
          writeAllowed: false,
          reason: 'schema owner review pending',
        },
      })
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EXPORT_GATE_CLOSED');
      expect(result.audit.export_gate_reason).toBe('schema owner review pending');
    }
  });

  it('creates a sanitized bounded payload after export acceptance and explicit gate approval', () => {
    const result = createSummaryEnrichmentPayload(
      createInput({
        summary: {
          text: `  复核摘要 Bearer abcdefghijklmnopqrst ${'x'.repeat(1_100)}  `,
          keyPoints: ['  要点一  ', '要点一', '要点二', ...Array.from({ length: 12 }, (_, i) => `要点${i + 3}`)],
          tags: ['标签一', '标签一', ...Array.from({ length: 20 }, (_, i) => `标签${i + 2}`)],
          caveat: 'Bearer abcdefghijklmnopqrst should not persist',
        },
      })
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.schema).toBe(SUMMARY_ENRICHMENT_SCHEMA_VERSION);
      expect(result.payload.llm_summary.text).not.toContain('abcdefghijklmnopqrst');
      expect(result.payload.llm_summary.text).toHaveLength(1_000);
      expect(result.payload.llm_summary.key_points).toHaveLength(8);
      expect(result.payload.llm_summary.key_points[0]).toBe('要点一');
      expect(result.payload.llm_summary.tags).toHaveLength(12);
      expect(result.payload.llm_summary.caveat).toBe('Bearer [redacted] should not persist');
      expect(result.payload.review.durable_write_allowed).toBe(true);
      expect(result.payload.runtime.production_changed).toBe(false);
    }
  });

  it('records audit fields without creating a payload helper side effect', () => {
    const audit = createSummaryEnrichmentAudit(
      createInput({
        runtime: {
          providerCall: false,
          mode: 'mock',
        },
        exportGate: {
          writeAllowed: false,
          reason: 'draft-only',
        },
      })
    );

    expect(audit).toEqual({
      schema: SUMMARY_ENRICHMENT_SCHEMA_VERSION,
      source: 'single_article_panel',
      review_state: 'accepted_for_export',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      mode: 'mock',
      provider_call: false,
      production_changed: false,
      export_write_allowed: false,
      export_gate_reason: 'draft-only',
      reviewed_at: '2026-07-04T09:12:00+08:00',
    });
  });

  it('redacts key-shaped strings during normalization', () => {
    const envName = ['DEEPSEEK', 'API', 'KEY'].join('_');
    const keyValue = ['sk', 'sensitive000000000000000'].join('-');

    expect(normalizeSummaryEnrichmentText(`${envName}=${keyValue}`)).toBe(`${envName}=[redacted]`);
  });
});
