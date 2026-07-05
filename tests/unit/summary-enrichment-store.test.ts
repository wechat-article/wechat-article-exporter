import { describe, expect, it } from 'vitest';
import {
  createAcceptedSummaryEnrichmentRecord,
  createJsonSummaryEnrichmentAttachment,
  getAcceptedSummaryEnrichmentRecord,
  loadAcceptedSummaryEnrichmentRecords,
  removeAcceptedSummaryEnrichmentRecord,
  saveAcceptedSummaryEnrichmentRecord,
  SUMMARY_ENRICHMENT_LOCAL_STORAGE_KEY,
  type SummaryEnrichmentStorageLike,
} from '~/utils/download/exporter/summaryEnrichmentStore';

function createMemoryStorage(initial: Record<string, string> = {}): SummaryEnrichmentStorageLike {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.get(key) || null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: key => {
      data.delete(key);
    },
  };
}

function createRecord(url = 'https://mp.weixin.qq.com/s/example') {
  return createAcceptedSummaryEnrichmentRecord({
    article: {
      title: 'WCPT Article',
      url,
    },
    summary: {
      text: '人工确认摘要',
      keyPoints: ['要点一'],
      tags: ['WCPT'],
      caveat: 'Reviewed locally.',
    },
    runtime: {
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      mode: 'mock',
      providerCall: false,
    },
    reviewedAt: '2026-07-04T20:00:00+08:00',
    updatedAt: '2026-07-04T20:00:00+08:00',
  });
}

describe('accepted summary enrichment store', () => {
  it('saves, loads, and removes accepted export records by article URL', () => {
    const storage = createMemoryStorage();
    const record = createRecord();

    expect(saveAcceptedSummaryEnrichmentRecord(record, storage)).toBe(true);
    expect(getAcceptedSummaryEnrichmentRecord(record.article.url, storage)).toMatchObject({
      review: { state: 'accepted_for_export' },
      runtime: { providerCall: false, productionChanged: false },
    });

    expect(removeAcceptedSummaryEnrichmentRecord(record.article.url, storage)).toBe(true);
    expect(getAcceptedSummaryEnrichmentRecord(record.article.url, storage)).toBeNull();
  });

  it('ignores corrupted or non-accepted storage payloads', () => {
    const storage = createMemoryStorage({
      [SUMMARY_ENRICHMENT_LOCAL_STORAGE_KEY]: JSON.stringify({
        'https://mp.weixin.qq.com/s/bad': {
          article: { title: 'Bad', url: 'https://mp.weixin.qq.com/s/bad' },
          summary: { text: 'bad' },
          review: { state: 'accepted_for_session' },
          runtime: { provider: 'deepseek', mode: 'mock', productionChanged: false },
        },
      }),
    });

    expect(loadAcceptedSummaryEnrichmentRecords(storage)).toEqual({});
  });

  it('keeps JSON export attachment closed by default', () => {
    const storage = createMemoryStorage();
    const record = createRecord();
    saveAcceptedSummaryEnrichmentRecord(record, storage);

    expect(
      createJsonSummaryEnrichmentAttachment({
        url: record.article.url,
        enabled: false,
        storage,
      })
    ).toEqual({
      attached: false,
      code: 'JSON_SUMMARY_EXPORT_DISABLED',
    });
  });

  it('attaches a sanitized payload only when JSON export gate is enabled and a record exists', () => {
    const storage = createMemoryStorage();
    const record = createRecord();
    saveAcceptedSummaryEnrichmentRecord(record, storage);

    const attachment = createJsonSummaryEnrichmentAttachment({
      url: record.article.url,
      enabled: true,
      reason: 'unit test JSON export gate',
      storage,
    });

    expect(attachment.attached).toBe(true);
    if (attachment.attached) {
      expect(attachment.payload).toMatchObject({
        schema: 'wcpt.summary_enrichment.v1',
        article: {
          title: 'WCPT Article',
          url: record.article.url,
        },
        llm_summary: {
          text: '人工确认摘要',
          key_points: ['要点一'],
          tags: ['WCPT'],
        },
        review: {
          state: 'accepted_for_export',
          durable_write_allowed: true,
        },
        runtime: {
          provider: 'deepseek',
          mode: 'mock',
          provider_call: false,
          production_changed: false,
        },
        audit: {
          export_write_allowed: true,
          export_gate_reason: 'unit test JSON export gate',
        },
      });
    }
  });

  it('does not attach when no accepted record exists for the exported URL', () => {
    const attachment = createJsonSummaryEnrichmentAttachment({
      url: 'https://mp.weixin.qq.com/s/missing',
      enabled: true,
      storage: createMemoryStorage(),
    });

    expect(attachment).toEqual({
      attached: false,
      code: 'ACCEPTED_SUMMARY_NOT_FOUND',
    });
  });
});
