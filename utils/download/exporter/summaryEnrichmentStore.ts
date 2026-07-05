import {
  createSummaryEnrichmentPayload,
  type SummaryEnrichmentInput,
  type SummaryEnrichmentMode,
  type SummaryEnrichmentPayload,
  type SummaryEnrichmentProvider,
  type SummaryEnrichmentResult,
  type SummaryEnrichmentSource,
} from './summaryEnrichment';

export const SUMMARY_ENRICHMENT_LOCAL_STORAGE_KEY = 'wcpt.summary_enrichment.accepted.v1';

export interface SummaryEnrichmentStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface AcceptedSummaryEnrichmentRecord {
  article: {
    title: string;
    url: string;
  };
  summary: {
    text: string;
    keyPoints: string[];
    tags: string[];
    caveat: string;
  };
  review: {
    state: 'accepted_for_export';
    source: SummaryEnrichmentSource;
    reviewedAt: string;
    reviewer?: string;
  };
  runtime: {
    provider: SummaryEnrichmentProvider;
    model: string;
    mode: SummaryEnrichmentMode;
    providerCall: boolean;
    productionChanged: false;
  };
  updatedAt: string;
}

export interface AcceptedSummaryEnrichmentRecordInput {
  article: {
    title: string;
    url: string;
  };
  summary: {
    text: string;
    keyPoints?: string[];
    tags?: string[];
    caveat?: string;
  };
  runtime: {
    provider: SummaryEnrichmentProvider;
    model: string;
    mode: SummaryEnrichmentMode;
    providerCall: boolean;
  };
  source?: SummaryEnrichmentSource;
  reviewer?: string;
  reviewedAt?: string;
  updatedAt?: string;
}

export function createAcceptedSummaryEnrichmentRecord(
  input: AcceptedSummaryEnrichmentRecordInput
): AcceptedSummaryEnrichmentRecord {
  const now = new Date().toISOString();
  return {
    article: {
      title: input.article.title,
      url: input.article.url,
    },
    summary: {
      text: input.summary.text,
      keyPoints: input.summary.keyPoints || [],
      tags: input.summary.tags || [],
      caveat: input.summary.caveat || '',
    },
    review: {
      state: 'accepted_for_export',
      source: input.source || 'single_article_panel',
      reviewedAt: input.reviewedAt || now,
      ...(input.reviewer ? { reviewer: input.reviewer } : {}),
    },
    runtime: {
      provider: input.runtime.provider,
      model: input.runtime.model,
      mode: input.runtime.mode,
      providerCall: input.runtime.providerCall,
      productionChanged: false,
    },
    updatedAt: input.updatedAt || now,
  };
}

export function saveAcceptedSummaryEnrichmentRecord(
  record: AcceptedSummaryEnrichmentRecord,
  storage = getDefaultSummaryEnrichmentStorage()
): boolean {
  if (!storage || !record.article.url || !record.summary.text.trim()) {
    return false;
  }

  const records = loadAcceptedSummaryEnrichmentRecords(storage);
  records[record.article.url] = record;
  storage.setItem(SUMMARY_ENRICHMENT_LOCAL_STORAGE_KEY, JSON.stringify(records));
  return true;
}

export function getAcceptedSummaryEnrichmentRecord(
  url: string,
  storage = getDefaultSummaryEnrichmentStorage()
): AcceptedSummaryEnrichmentRecord | null {
  if (!storage || !url) {
    return null;
  }
  return loadAcceptedSummaryEnrichmentRecords(storage)[url] || null;
}

export function removeAcceptedSummaryEnrichmentRecord(
  url: string,
  storage = getDefaultSummaryEnrichmentStorage()
): boolean {
  if (!storage || !url) {
    return false;
  }
  const records = loadAcceptedSummaryEnrichmentRecords(storage);
  if (!records[url]) {
    return false;
  }
  delete records[url];
  storage.setItem(SUMMARY_ENRICHMENT_LOCAL_STORAGE_KEY, JSON.stringify(records));
  return true;
}

export function loadAcceptedSummaryEnrichmentRecords(
  storage = getDefaultSummaryEnrichmentStorage()
): Record<string, AcceptedSummaryEnrichmentRecord> {
  if (!storage) {
    return {};
  }
  try {
    const parsed = JSON.parse(storage.getItem(SUMMARY_ENRICHMENT_LOCAL_STORAGE_KEY) || '{}');
    return isRecordMap(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function createStoredSummaryEnrichmentPayload(
  record: AcceptedSummaryEnrichmentRecord,
  exportGate: { writeAllowed: boolean; reason: string }
): SummaryEnrichmentResult {
  const input: SummaryEnrichmentInput = {
    article: record.article,
    summary: record.summary,
    review: record.review,
    runtime: record.runtime,
    exportGate,
  };
  return createSummaryEnrichmentPayload(input);
}

export function getDefaultSummaryEnrichmentStorage(): SummaryEnrichmentStorageLike | null {
  return typeof window !== 'undefined' ? window.localStorage : null;
}

function isRecordMap(value: unknown): value is Record<string, AcceptedSummaryEnrichmentRecord> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every(isAcceptedRecord);
}

function isAcceptedRecord(value: unknown): value is AcceptedSummaryEnrichmentRecord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as AcceptedSummaryEnrichmentRecord;
  return (
    Boolean(record.article?.url) &&
    typeof record.summary?.text === 'string' &&
    record.review?.state === 'accepted_for_export' &&
    (record.runtime?.provider === 'deepseek' || record.runtime?.provider === 'kimi') &&
    (record.runtime?.mode === 'mock' || record.runtime?.mode === 'live') &&
    record.runtime?.productionChanged === false
  );
}

export type JsonSummaryEnrichmentAttachment =
  | {
      attached: true;
      payload: SummaryEnrichmentPayload;
    }
  | {
      attached: false;
      code: 'JSON_SUMMARY_EXPORT_DISABLED' | 'ACCEPTED_SUMMARY_NOT_FOUND' | 'SUMMARY_ENRICHMENT_BLOCKED';
    };

export function createJsonSummaryEnrichmentAttachment(options: {
  url: string;
  enabled: boolean;
  reason?: string;
  storage?: SummaryEnrichmentStorageLike | null;
}): JsonSummaryEnrichmentAttachment {
  if (!options.enabled) {
    return {
      attached: false,
      code: 'JSON_SUMMARY_EXPORT_DISABLED',
    };
  }

  const record = getAcceptedSummaryEnrichmentRecord(options.url, options.storage ?? getDefaultSummaryEnrichmentStorage());
  if (!record) {
    return {
      attached: false,
      code: 'ACCEPTED_SUMMARY_NOT_FOUND',
    };
  }

  const result = createStoredSummaryEnrichmentPayload(record, {
    writeAllowed: true,
    reason: options.reason || 'json export summary enrichment enabled',
  });

  if (!result.ok) {
    return {
      attached: false,
      code: 'SUMMARY_ENRICHMENT_BLOCKED',
    };
  }

  return {
    attached: true,
    payload: result.payload,
  };
}
