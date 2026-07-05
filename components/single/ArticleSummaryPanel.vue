<script setup lang="ts">
import { getHtmlCache } from '~/store/v2/html';
import {
  createAcceptedSummaryEnrichmentRecord,
  removeAcceptedSummaryEnrichmentRecord,
  saveAcceptedSummaryEnrichmentRecord,
} from '~/utils/download/exporter/summaryEnrichmentStore';

interface SummaryPanelArticle {
  title: string;
  link: string;
  digest: string;
  contentDownload: boolean;
}

const props = defineProps<{
  article: SummaryPanelArticle | null;
  selectedCount: number;
}>();

const {
  loading,
  summary,
  issue,
  mode,
  provider,
  model,
  statusCode,
  providerCallAttempted,
  clear,
  summarize,
} = useArticleSummary();
const {
  reviewState,
  reviewLabel,
  draftSummary,
  editText,
  reviewSnapshot,
  loadDraft,
  resetReview,
  startEditing,
  saveEdit,
  cancelEdit,
  acceptForSession,
  acceptForExport,
  rejectDraft,
} = useArticleSummaryReview();

const panelIssue = shallowRef('');

const canSummarize = computed(() => {
  return props.selectedCount === 1 && Boolean(props.article?.contentDownload);
});

const stateLabel = computed(() => {
  if (props.selectedCount === 0) return '请选择一篇文章';
  if (props.selectedCount > 1) return '仅支持单篇处理';
  if (!props.article?.contentDownload) return '需要先抓取正文';
  if (summary.value) return '摘要已生成';
  return '本地缓存就绪';
});

const selectedTitle = computed(() => props.article?.title || '未选择文章');
const visibleIssue = computed(() => panelIssue.value || issue.value);
const visibleSummaryText = computed(() => draftSummary.value || summary.value?.summary || '');

watch(
  () => props.article?.link,
  () => {
    panelIssue.value = '';
    resetReview();
    clear();
  }
);

watch(
  () => summary.value?.summary || '',
  nextSummary => {
    if (nextSummary) {
      if (props.article?.link) {
        removeAcceptedSummaryEnrichmentRecord(props.article.link);
      }
      loadDraft(nextSummary);
      return;
    }
    resetReview();
  }
);

async function onSummarize() {
  panelIssue.value = '';
  if (!props.article) {
    panelIssue.value = '请先选择一篇文章。';
    return;
  }
  if (!props.article.contentDownload) {
    panelIssue.value = '请先抓取正文，再生成摘要。';
    return;
  }

  const htmlAsset = await getHtmlCache(props.article.link);
  if (!htmlAsset) {
    panelIssue.value = '未找到本地正文缓存，请重新抓取正文。';
    return;
  }

  await summarize({
    title: props.article.title,
    url: props.article.link,
    digest: props.article.digest,
    html: await htmlAsset.file.text(),
  });
}

function onAcceptForExport() {
  panelIssue.value = '';
  if (!props.article || !summary.value) {
    panelIssue.value = '请先生成并复核摘要。';
    return;
  }

  const text = draftSummary.value || summary.value.summary;
  if (!text) {
    panelIssue.value = '摘要为空，无法允许导出。';
    return;
  }

  const currentMode = mode.value === 'live' ? 'live' : 'mock';
  const saved = saveAcceptedSummaryEnrichmentRecord(
    createAcceptedSummaryEnrichmentRecord({
      article: {
        title: props.article.title,
        url: props.article.link,
      },
      summary: {
        text,
        keyPoints: summary.value.key_points,
        tags: summary.value.tags,
        caveat: summary.value.caveat,
      },
      runtime: {
        provider: provider.value,
        model: model.value || 'unknown',
        mode: currentMode,
        providerCall: providerCallAttempted.value,
      },
      source: 'single_article_panel',
    })
  );

  if (!saved) {
    panelIssue.value = '当前浏览器未能保存导出许可。';
    return;
  }
  acceptForExport();
}

function onRejectDraft() {
  rejectDraft();
  if (props.article?.link) {
    removeAcceptedSummaryEnrichmentRecord(props.article.link);
  }
}
</script>

<template>
  <section class="summary-panel" role="region" aria-label="DeepSeek 文章摘要">
    <div class="summary-panel__header">
      <div class="summary-panel__title-group">
        <div class="summary-panel__icon" aria-hidden="true">
          <UIcon name="i-heroicons-sparkles-20-solid" class="size-4" />
        </div>
        <div class="min-w-0">
          <h2 class="summary-panel__title">DeepSeek 文章摘要</h2>
          <p class="summary-panel__subtitle">
            {{ selectedTitle }}
          </p>
        </div>
      </div>

      <div class="summary-panel__actions">
        <span class="summary-panel__status">{{ stateLabel }}</span>
        <UButton
          size="sm"
          color="white"
          icon="i-heroicons-sparkles-20-solid"
          :loading="loading"
          :disabled="!canSummarize"
          @click="onSummarize"
        >
          生成摘要
        </UButton>
      </div>
    </div>

    <div class="summary-panel__body">
      <div v-if="summary" class="summary-panel__result" data-testid="single-article-summary-result">
        <div class="summary-panel__summary">
          <template v-if="reviewState !== 'editing'">
            {{ visibleSummaryText }}
          </template>
          <div v-else class="summary-panel__edit">
            <textarea
              v-model="editText"
              class="summary-panel__textarea"
              data-testid="single-article-review-editor"
              aria-label="编辑摘要草稿"
            />
            <div class="summary-panel__review-actions">
              <UButton
                size="xs"
                color="white"
                data-testid="single-article-review-save"
                @click="saveEdit()"
              >
                保存编辑
              </UButton>
              <UButton
                size="xs"
                color="white"
                data-testid="single-article-review-cancel"
                @click="cancelEdit"
              >
                取消编辑
              </UButton>
            </div>
          </div>
        </div>

        <ol v-if="summary.key_points.length" class="summary-panel__points">
          <li v-for="point in summary.key_points" :key="point">
            {{ point }}
          </li>
        </ol>

        <div class="summary-panel__meta">
          <span v-for="tag in summary.tags" :key="tag" class="summary-panel__tag">{{ tag }}</span>
          <span class="summary-panel__boundary">providerCallAttempted: {{ providerCallAttempted }}</span>
          <span class="summary-panel__boundary">mode: {{ mode }}</span>
          <span class="summary-panel__boundary">provider: {{ provider }}</span>
        </div>

        <div class="summary-panel__review" data-testid="single-article-summary-review">
          <div class="summary-panel__review-state">
            <span>人工复核：{{ reviewLabel }}</span>
            <span>review: {{ reviewState }}</span>
            <span>accepted: {{ reviewSnapshot.accepted }}</span>
            <span>durableWriteAllowed: {{ reviewSnapshot.durableWriteAllowed }}</span>
          </div>
          <div class="summary-panel__review-actions">
            <UButton
              size="xs"
              color="white"
              icon="i-heroicons-pencil-square-20-solid"
              :disabled="reviewState === 'editing' || reviewState === 'rejected' || reviewState === 'accepted_for_export'"
              data-testid="single-article-review-edit"
              @click="startEditing"
            >
              编辑摘要
            </UButton>
            <UButton
              size="xs"
              color="white"
              icon="i-heroicons-check-20-solid"
              :disabled="reviewState === 'editing' || reviewState === 'rejected' || reviewState === 'accepted_for_export'"
              data-testid="single-article-review-accept"
              @click="acceptForSession"
            >
              接受本次草稿
            </UButton>
            <UButton
              size="xs"
              color="white"
              icon="i-heroicons-document-check-20-solid"
              :disabled="reviewState === 'editing' || reviewState === 'rejected'"
              data-testid="single-article-review-accept-export"
              @click="onAcceptForExport"
            >
              允许 JSON 导出
            </UButton>
            <UButton
              size="xs"
              color="white"
              icon="i-heroicons-x-mark-20-solid"
              :disabled="reviewState === 'editing'"
              data-testid="single-article-review-reject"
              @click="onRejectDraft"
            >
              退回草稿
            </UButton>
          </div>
        </div>
      </div>

      <div v-else class="summary-panel__empty" data-testid="single-article-summary-empty">
        <p>{{ visibleIssue || '摘要不会自动生成。选中一篇已抓取正文的文章后，可在 mock gate 中本地预览。' }}</p>
        <span v-if="statusCode" class="summary-panel__boundary">code: {{ statusCode }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary-panel {
  border-bottom: 1px solid var(--cc-border);
  background:
    linear-gradient(90deg, rgba(215, 92, 112, 0.065), transparent 42%),
    rgba(255, 255, 255, 0.5);
  box-shadow: var(--cc-shadow-line);
}

.summary-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 16px;
}

.summary-panel__title-group {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.summary-panel__icon {
  display: grid;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  place-items: center;
  border: 1px solid var(--cc-border-strong);
  background: rgba(255, 255, 255, 0.58);
  color: var(--cc-accent-hover);
}

.summary-panel__title {
  margin: 0;
  color: var(--cc-text);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0;
}

.summary-panel__subtitle {
  margin: 3px 0 0;
  max-width: min(52vw, 720px);
  overflow: hidden;
  color: var(--cc-text-muted);
  font-size: 12px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.summary-panel__actions {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 10px;
}

.summary-panel__status {
  border: 1px solid var(--cc-border);
  background: rgba(255, 255, 255, 0.52);
  color: var(--cc-text-muted);
  padding: 5px 10px;
  font-size: 12px;
  line-height: 1;
}

.summary-panel__body {
  border-top: 1px solid var(--cc-border);
  padding: 12px 16px 14px;
}

.summary-panel__result {
  display: grid;
  gap: 10px;
}

.summary-panel__summary {
  max-width: 96ch;
  color: var(--cc-text);
  font-size: 13px;
  line-height: 1.75;
}

.summary-panel__points {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.summary-panel__points li {
  border-left: 2px solid var(--cc-accent);
  background: rgba(255, 255, 255, 0.42);
  color: var(--cc-text-muted);
  padding: 8px 10px;
  font-size: 12px;
  line-height: 1.55;
}

.summary-panel__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.summary-panel__review {
  display: grid;
  gap: 8px;
  border-top: 1px solid var(--cc-border);
  padding-top: 10px;
}

.summary-panel__review-state {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.summary-panel__review-state span {
  border: 1px solid var(--cc-border);
  background: rgba(255, 255, 255, 0.58);
  color: var(--cc-text-muted);
  padding: 4px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1;
}

.summary-panel__review-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary-panel__edit {
  display: grid;
  gap: 8px;
}

.summary-panel__textarea {
  width: 100%;
  min-height: 88px;
  resize: vertical;
  border: 1px solid var(--cc-border-strong);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.72);
  color: var(--cc-text);
  padding: 10px 12px;
  font: inherit;
  line-height: 1.7;
  outline: none;
}

.summary-panel__textarea:focus {
  border-color: var(--cc-accent);
  box-shadow: 0 0 0 3px rgba(215, 92, 112, 0.12);
}

.summary-panel__tag,
.summary-panel__boundary {
  border: 1px solid var(--cc-border);
  background: rgba(253, 248, 246, 0.68);
  color: var(--cc-text-muted);
  padding: 4px 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  line-height: 1;
}

.summary-panel__tag {
  color: var(--cc-accent-hover);
}

.summary-panel__empty {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--cc-text-muted);
  font-size: 12px;
  line-height: 1.6;
}

.summary-panel__empty p {
  margin: 0;
}

@media (max-width: 860px) {
  .summary-panel__header {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-panel__actions {
    justify-content: space-between;
  }

  .summary-panel__review-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .summary-panel__subtitle {
    max-width: 100%;
  }

  .summary-panel__points {
    grid-template-columns: 1fr;
  }
}
</style>
