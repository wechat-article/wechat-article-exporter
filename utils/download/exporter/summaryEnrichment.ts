export const SUMMARY_ENRICHMENT_SCHEMA_VERSION = 'wcpt.summary_enrichment.v1';

export type SummaryEnrichmentReviewState =
  | 'draft_generated'
  | 'accepted_for_session'
  | 'accepted_for_export'
  | 'rejected';

export type SummaryEnrichmentMode = 'mock' | 'live';
export type SummaryEnrichmentProvider = 'deepseek' | 'kimi';
export type SummaryEnrichmentSource = 'single_article_panel' | 'manual_import';

export interface SummaryEnrichmentInput {
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
  review: {
    state: SummaryEnrichmentReviewState;
    source: SummaryEnrichmentSource;
    reviewedAt: string;
    reviewer?: string;
  };
  runtime: {
    provider: SummaryEnrichmentProvider;
    model: string;
    mode: SummaryEnrichmentMode;
    providerCall: boolean;
    productionChanged: boolean;
  };
  exportGate: {
    writeAllowed: boolean;
    reason: string;
  };
}

export interface SummaryEnrichmentAudit {
  schema: typeof SUMMARY_ENRICHMENT_SCHEMA_VERSION;
  source: SummaryEnrichmentSource;
  review_state: SummaryEnrichmentReviewState;
  provider: SummaryEnrichmentProvider;
  model: string;
  mode: SummaryEnrichmentMode;
  provider_call: boolean;
  production_changed: boolean;
  export_write_allowed: boolean;
  export_gate_reason: string;
  reviewed_at: string;
}

export interface SummaryEnrichmentPayload {
  schema: typeof SUMMARY_ENRICHMENT_SCHEMA_VERSION;
  article: {
    title: string;
    url: string;
  };
  llm_summary: {
    text: string;
    key_points: string[];
    tags: string[];
    caveat: string;
  };
  review: {
    state: 'accepted_for_export';
    source: SummaryEnrichmentSource;
    reviewed_at: string;
    reviewer?: string;
    durable_write_allowed: true;
  };
  runtime: {
    provider: SummaryEnrichmentProvider;
    model: string;
    mode: SummaryEnrichmentMode;
    provider_call: boolean;
    production_changed: false;
  };
  audit: SummaryEnrichmentAudit;
}

export type SummaryEnrichmentBlockCode =
  | 'SUMMARY_EMPTY'
  | 'SUMMARY_NOT_ACCEPTED_FOR_EXPORT'
  | 'EXPORT_GATE_CLOSED'
  | 'PRODUCTION_BOUNDARY_OPEN';

export type SummaryEnrichmentResult =
  | {
      ok: true;
      payload: SummaryEnrichmentPayload;
      audit: SummaryEnrichmentAudit;
    }
  | {
      ok: false;
      code: SummaryEnrichmentBlockCode;
      audit: SummaryEnrichmentAudit;
    };

const MAX_SUMMARY_CHARS = 1_000;
const MAX_KEY_POINT_CHARS = 240;
const MAX_KEY_POINTS = 8;
const MAX_TAG_CHARS = 40;
const MAX_TAGS = 12;
const MAX_CAVEAT_CHARS = 500;
const MAX_TITLE_CHARS = 240;
const MAX_URL_CHARS = 1_000;
const MAX_MODEL_CHARS = 120;
const MAX_REASON_CHARS = 240;
const MAX_REVIEWER_CHARS = 120;

export function createSummaryEnrichmentAudit(input: SummaryEnrichmentInput): SummaryEnrichmentAudit {
  return {
    schema: SUMMARY_ENRICHMENT_SCHEMA_VERSION,
    source: input.review.source,
    review_state: input.review.state,
    provider: input.runtime.provider,
    model: normalizeSummaryEnrichmentText(input.runtime.model, MAX_MODEL_CHARS),
    mode: input.runtime.mode,
    provider_call: input.runtime.providerCall,
    production_changed: input.runtime.productionChanged,
    export_write_allowed: input.exportGate.writeAllowed,
    export_gate_reason: normalizeSummaryEnrichmentText(input.exportGate.reason, MAX_REASON_CHARS),
    reviewed_at: normalizeSummaryEnrichmentText(input.review.reviewedAt, MAX_REASON_CHARS),
  };
}

export function createSummaryEnrichmentPayload(input: SummaryEnrichmentInput): SummaryEnrichmentResult {
  const audit = createSummaryEnrichmentAudit(input);
  const text = normalizeSummaryEnrichmentText(input.summary.text, MAX_SUMMARY_CHARS);

  if (!text) {
    return {
      ok: false,
      code: 'SUMMARY_EMPTY',
      audit,
    };
  }

  if (input.review.state !== 'accepted_for_export') {
    return {
      ok: false,
      code: 'SUMMARY_NOT_ACCEPTED_FOR_EXPORT',
      audit,
    };
  }

  if (!input.exportGate.writeAllowed) {
    return {
      ok: false,
      code: 'EXPORT_GATE_CLOSED',
      audit,
    };
  }

  if (input.runtime.productionChanged) {
    return {
      ok: false,
      code: 'PRODUCTION_BOUNDARY_OPEN',
      audit,
    };
  }

  const reviewer = normalizeSummaryEnrichmentText(input.review.reviewer || '', MAX_REVIEWER_CHARS);
  const payload: SummaryEnrichmentPayload = {
    schema: SUMMARY_ENRICHMENT_SCHEMA_VERSION,
    article: {
      title: normalizeSummaryEnrichmentText(input.article.title, MAX_TITLE_CHARS),
      url: normalizeSummaryEnrichmentText(input.article.url, MAX_URL_CHARS),
    },
    llm_summary: {
      text,
      key_points: normalizeSummaryEnrichmentList(input.summary.keyPoints || [], MAX_KEY_POINTS, MAX_KEY_POINT_CHARS),
      tags: normalizeSummaryEnrichmentList(input.summary.tags || [], MAX_TAGS, MAX_TAG_CHARS),
      caveat: normalizeSummaryEnrichmentText(input.summary.caveat || '', MAX_CAVEAT_CHARS),
    },
    review: {
      state: 'accepted_for_export',
      source: input.review.source,
      reviewed_at: normalizeSummaryEnrichmentText(input.review.reviewedAt, MAX_REASON_CHARS),
      durable_write_allowed: true,
    },
    runtime: {
      provider: input.runtime.provider,
      model: normalizeSummaryEnrichmentText(input.runtime.model, MAX_MODEL_CHARS),
      mode: input.runtime.mode,
      provider_call: input.runtime.providerCall,
      production_changed: false,
    },
    audit,
  };

  if (reviewer) {
    payload.review.reviewer = reviewer;
  }

  return {
    ok: true,
    payload,
    audit,
  };
}

export function normalizeSummaryEnrichmentText(value: string, maxChars = MAX_SUMMARY_CHARS): string {
  return redactSensitiveText(value).replace(/\s+/g, ' ').trim().slice(0, maxChars);
}

function normalizeSummaryEnrichmentList(values: string[], maxItems: number, maxChars: number): string[] {
  const normalized: string[] = [];
  for (const value of values) {
    const item = normalizeSummaryEnrichmentText(value, maxChars);
    if (item && !normalized.includes(item)) {
      normalized.push(item);
    }
    if (normalized.length >= maxItems) {
      break;
    }
  }
  return normalized;
}

function redactSensitiveText(value: string): string {
  return value
    .replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[redacted]')
    .replace(/\b(Bearer\s+)[A-Za-z0-9._-]{12,}\b/gi, '$1[redacted]')
    .replace(/\b((?:DEEPSEEK|KIMI|MOONSHOT|OPENAI)_API_KEY=)[^\s]+/gi, '$1[redacted]');
}
