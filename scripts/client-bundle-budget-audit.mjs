#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { gzipSync } from 'node:zlib';

const ROOT = path.resolve(import.meta.dirname, '..');
const PUBLIC_NUXT_DIR = path.join(ROOT, '.output/public/_nuxt');
const OUTPUT_DIR = path.join(ROOT, 'tmp/outputs/client-bundle-budget-audit-20260705');
const JSON_PATH = path.join(OUTPUT_DIR, 'result.json');
const MARKDOWN_PATH = path.join(OUTPUT_DIR, 'result.md');
const KIB = 1024;

const CHUNK_SIZE_WARNING_LIMIT_KB = 1100;
const LARGE_CHUNK_THRESHOLD_BYTES = 500 * KIB;

const BUDGETS = {
  'common-core': {
    maxBytes: 750 * KIB,
    lazy: false,
    rationale: 'Shared runtime must stay small enough for the private dashboard first load.',
  },
  'ag-grid-community': {
    maxBytes: 1100 * KIB,
    lazy: true,
    rationale: 'AG Grid is route-level dashboard grid runtime, not the public landing path.',
  },
  'ag-grid-enterprise': {
    maxBytes: 1100 * KIB,
    lazy: true,
    rationale: 'Enterprise grid module is route-level and license-gated by runtime config.',
  },
  'ag-grid-locale': {
    maxBytes: 650 * KIB,
    lazy: true,
    rationale: 'Grid locale payload is route-level and should not grow into common runtime.',
  },
  'ag-grid-vue': {
    maxBytes: 220 * KIB,
    lazy: true,
    rationale: 'Vue grid adapter should remain a small route-level adapter.',
  },
  'excel-export-lazy': {
    maxBytes: 1100 * KIB,
    lazy: true,
    rationale: 'ExcelJS is loaded only when the user explicitly exports Excel.',
  },
  'exporter-parser-lazy': {
    maxBytes: 450 * KIB,
    lazy: true,
    rationale: 'HTML parser/exporter code is export-path lazy code and should remain below 450 KiB.',
  },
  'app-route': {
    maxBytes: 500 * KIB,
    lazy: true,
    rationale: 'Application route chunks should stay under the generic Vite large-chunk threshold.',
  },
  unknown: {
    maxBytes: 500 * KIB,
    lazy: false,
    rationale: 'Unclassified client chunks should not exceed the generic large-chunk threshold.',
  },
};

const result = buildAudit();
mkdirSync(OUTPUT_DIR, { recursive: true });
writeFileSync(JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
writeFileSync(MARKDOWN_PATH, renderMarkdown(result));

console.log(`json=${path.relative(ROOT, JSON_PATH)}`);
console.log(`markdown=${path.relative(ROOT, MARKDOWN_PATH)}`);
console.log(`readyForLargeChunkCloseout=${result.readyForLargeChunkCloseout}`);
console.log(`violationCount=${result.summary.violationCount}`);

if (!result.readyForLargeChunkCloseout) {
  process.exitCode = 1;
}

function buildAudit() {
  if (!existsSync(PUBLIC_NUXT_DIR)) {
    return {
      schema: 'wcpt.client_bundle_budget_audit.v1',
      checkedAt: new Date().toISOString(),
      publicNuxtDir: path.relative(ROOT, PUBLIC_NUXT_DIR),
      readyForLargeChunkCloseout: false,
      summary: {
        chunkCount: 0,
        largeChunkCount: 0,
        acceptedLargeChunkCount: 0,
        violationCount: 1,
      },
      chunks: [],
      violations: [
        {
          code: 'PUBLIC_NUXT_DIR_MISSING',
          severity: 'high',
          detail: 'Run yarn build before the client bundle budget audit.',
        },
      ],
      boundaries: buildBoundaries(),
    };
  }

  const chunks = readdirSync(PUBLIC_NUXT_DIR)
    .filter(file => file.endsWith('.js'))
    .sort()
    .map(file => inspectChunk(file))
    .sort((a, b) => b.bytes - a.bytes || a.file.localeCompare(b.file));

  const violations = chunks.flatMap(chunk => buildViolations(chunk));
  const largeChunks = chunks.filter(chunk => chunk.bytes > LARGE_CHUNK_THRESHOLD_BYTES);
  const acceptedLargeChunks = largeChunks.filter(chunk => chunk.withinBudget && chunk.budget?.lazy === true);

  return {
    schema: 'wcpt.client_bundle_budget_audit.v1',
    checkedAt: new Date().toISOString(),
    publicNuxtDir: path.relative(ROOT, PUBLIC_NUXT_DIR),
    chunkSizeWarningLimitKb: CHUNK_SIZE_WARNING_LIMIT_KB,
    largeChunkThresholdBytes: LARGE_CHUNK_THRESHOLD_BYTES,
    readyForLargeChunkCloseout: violations.length === 0,
    summary: {
      chunkCount: chunks.length,
      largeChunkCount: largeChunks.length,
      acceptedLargeChunkCount: acceptedLargeChunks.length,
      violationCount: violations.length,
      largestChunkBytes: chunks.at(0)?.bytes ?? 0,
      largestChunkFile: chunks.at(0)?.file ?? null,
    },
    budgets: BUDGETS,
    chunks,
    largeChunks,
    acceptedLargeChunks,
    violations,
    boundaries: buildBoundaries(),
  };
}

function inspectChunk(file) {
  const filePath = path.join(PUBLIC_NUXT_DIR, file);
  const source = readFileSync(filePath);
  const bytes = statSync(filePath).size;
  const gzipBytes = gzipSync(source).length;
  const sourceMap = readSourceMap(filePath);
  const classification = classifyChunk(sourceMap);
  const budget = BUDGETS[classification] || BUDGETS.unknown;

  return {
    file,
    bytes,
    gzipBytes,
    overGenericThreshold: bytes > LARGE_CHUNK_THRESHOLD_BYTES,
    classification,
    budget,
    withinBudget: bytes <= budget.maxBytes,
    sourceCount: sourceMap?.sources?.length ?? 0,
    topSourceBuckets: topSourceBuckets(sourceMap).slice(0, 8),
  };
}

function readSourceMap(filePath) {
  const mapPath = `${filePath}.map`;
  if (!existsSync(mapPath)) return null;

  try {
    return JSON.parse(readFileSync(mapPath, 'utf8'));
  } catch (error) {
    return {
      parseError: error instanceof Error ? error.message : String(error),
      sources: [],
      sourcesContent: [],
    };
  }
}

function classifyChunk(sourceMap) {
  const sourceText = sourceMap?.sources?.join('\n') || '';

  if (sourceText.includes('/node_modules/ag-grid-vue3/')) return 'ag-grid-vue';
  if (sourceText.includes('/node_modules/@ag-grid-community/locale/')) return 'ag-grid-locale';
  if (sourceText.includes('/node_modules/ag-grid-enterprise/')) return 'ag-grid-enterprise';
  if (sourceText.includes('/node_modules/ag-grid-community/')) return 'ag-grid-community';
  if (sourceText.includes('/node_modules/exceljs/')) return 'excel-export-lazy';
  if (
    sourceText.includes('/node_modules/parse5/') ||
    sourceText.includes('/node_modules/cheerio/') ||
    sourceText.includes('/node_modules/turndown/') ||
    sourceText.includes('/utils/download/')
  ) {
    return 'exporter-parser-lazy';
  }
  if (
    sourceText.includes('/node_modules/vue/') ||
    sourceText.includes('/node_modules/@vue/') ||
    sourceText.includes('/node_modules/@nuxt/') ||
    sourceText.includes('/node_modules/nuxt/')
  ) {
    return 'common-core';
  }
  if (sourceMap?.sources?.length) return 'app-route';
  return 'unknown';
}

function buildViolations(chunk) {
  const violations = [];

  if (!chunk.sourceCount) {
    violations.push({
      code: 'CHUNK_SOURCEMAP_MISSING',
      severity: 'medium',
      file: chunk.file,
      detail: 'Client sourcemap is required so large chunks can be attributed.',
    });
  }

  if (!chunk.withinBudget) {
    violations.push({
      code: 'CHUNK_BUDGET_EXCEEDED',
      severity: 'medium',
      file: chunk.file,
      classification: chunk.classification,
      bytes: chunk.bytes,
      budgetBytes: chunk.budget.maxBytes,
      detail: `${chunk.classification} chunk exceeds its project budget.`,
    });
  }

  if (chunk.overGenericThreshold && chunk.budget.lazy !== true && chunk.classification !== 'common-core') {
    violations.push({
      code: 'UNACCEPTED_LARGE_CHUNK',
      severity: 'medium',
      file: chunk.file,
      classification: chunk.classification,
      bytes: chunk.bytes,
      detail: 'Chunks over 500 KiB must be classified as accepted lazy chunks or common-core under budget.',
    });
  }

  return violations;
}

function topSourceBuckets(sourceMap) {
  const sources = Array.isArray(sourceMap?.sources) ? sourceMap.sources : [];
  const contents = Array.isArray(sourceMap?.sourcesContent) ? sourceMap.sourcesContent : [];
  const buckets = new Map();

  sources.forEach((source, index) => {
    const bucket = bucketSource(source);
    const bytes = Buffer.byteLength(contents[index] || '', 'utf8');
    buckets.set(bucket, (buckets.get(bucket) || 0) + bytes);
  });

  return Array.from(buckets.entries())
    .map(([bucket, sourceBytes]) => ({ bucket, sourceBytes }))
    .sort((a, b) => b.sourceBytes - a.sourceBytes);
}

function bucketSource(source) {
  const nodeModulesMatch = source.match(/\/node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (nodeModulesMatch) return nodeModulesMatch[1];

  const projectMatch = source.match(/\/(?:components|composables|pages|shared|utils|server)\/[^?]+/);
  if (projectMatch) return projectMatch[0].replace(/^\//, '');

  return source.replace(/^.*\/wechat-article-exporter\//, '').slice(0, 120);
}

function renderMarkdown(audit) {
  const rows = audit.chunks
    .map(
      chunk =>
        `| ${chunk.file} | ${formatBytes(chunk.bytes)} | ${formatBytes(chunk.gzipBytes)} | ${chunk.classification} | ${formatBytes(chunk.budget.maxBytes)} | ${chunk.withinBudget ? 'yes' : 'no'} |`
    )
    .join('\n');
  const violationRows = audit.violations.length
    ? audit.violations
        .map(item => `| ${item.code} | ${item.severity} | ${item.file || ''} | ${item.detail} |`)
        .join('\n')
    : '| none | none |  |  |';

  return [
    '---',
    'title: WCPT Client Bundle Budget Audit',
    `date: ${audit.checkedAt.slice(0, 10)}`,
    'status: evidence',
    'scope: client-bundle, large-chunk-closeout, tencent-lighthouse',
    '---',
    '',
    '# WCPT Client Bundle Budget Audit',
    '',
    `- Ready for large-chunk closeout: ${audit.readyForLargeChunkCloseout}`,
    `- Chunk size warning limit: ${audit.chunkSizeWarningLimitKb} KiB`,
    `- Generic large-chunk threshold: ${formatBytes(audit.largeChunkThresholdBytes)}`,
    `- Large chunks: ${audit.summary.largeChunkCount}`,
    `- Accepted large chunks: ${audit.summary.acceptedLargeChunkCount}`,
    `- Violations: ${audit.summary.violationCount}`,
    `- provider_call: ${audit.boundaries.provider_call}`,
    `- production_changed: ${audit.boundaries.production_changed}`,
    '',
    '## Chunks',
    '',
    '| File | Size | Gzip | Classification | Budget | Within budget |',
    '| --- | ---: | ---: | --- | ---: | --- |',
    rows || '| none | 0 B | 0 B | none | 0 B | no |',
    '',
    '## Violations',
    '',
    '| Code | Severity | File | Detail |',
    '| --- | --- | --- | --- |',
    violationRows,
    '',
  ].join('\n');
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'unknown';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} B`;
}

function buildBoundaries() {
  return {
    provider_call: false,
    production_changed: false,
    deploy_attempted: false,
    remote_mutation: false,
    live_send: false,
  };
}
