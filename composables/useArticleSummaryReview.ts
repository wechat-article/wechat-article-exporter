import { computed, shallowRef } from 'vue';

export type ArticleSummaryReviewState =
  | 'not_generated'
  | 'draft_generated'
  | 'editing'
  | 'accepted_for_session'
  | 'accepted_for_export'
  | 'rejected';

export interface ArticleSummaryReviewSnapshot {
  state: ArticleSummaryReviewState;
  draft: string;
  accepted: boolean;
  durableWriteAllowed: boolean;
}

export function normalizeReviewSummaryText(value: string): string {
  return value.replace(/\s+/g, ' ').trim().slice(0, 1_000);
}

export function createArticleSummaryReviewSnapshot(
  state: ArticleSummaryReviewState,
  draft: string
): ArticleSummaryReviewSnapshot {
  return {
    state,
    draft: normalizeReviewSummaryText(draft),
    accepted: state === 'accepted_for_session' || state === 'accepted_for_export',
    durableWriteAllowed: state === 'accepted_for_export',
  };
}

export function useArticleSummaryReview() {
  const reviewState = shallowRef<ArticleSummaryReviewState>('not_generated');
  const draftSummary = shallowRef('');
  const editText = shallowRef('');

  const reviewLabel = computed(() => {
    if (reviewState.value === 'accepted_for_export') return '已允许 JSON 导出';
    if (reviewState.value === 'accepted_for_session') return '已接受本次草稿';
    if (reviewState.value === 'rejected') return '已退回';
    if (reviewState.value === 'editing') return '编辑中';
    if (reviewState.value === 'draft_generated') return '待人工复核';
    return '未生成';
  });

  const reviewSnapshot = computed(() =>
    createArticleSummaryReviewSnapshot(reviewState.value, draftSummary.value)
  );

  function loadDraft(summary: string) {
    draftSummary.value = normalizeReviewSummaryText(summary);
    editText.value = draftSummary.value;
    reviewState.value = draftSummary.value ? 'draft_generated' : 'not_generated';
  }

  function resetReview() {
    reviewState.value = 'not_generated';
    draftSummary.value = '';
    editText.value = '';
  }

  function startEditing() {
    if (!draftSummary.value || reviewState.value === 'rejected' || reviewState.value === 'accepted_for_export') {
      return;
    }
    editText.value = draftSummary.value;
    reviewState.value = 'editing';
  }

  function saveEdit(value: string = editText.value) {
    const normalized = normalizeReviewSummaryText(value);
    if (!normalized) {
      return;
    }
    draftSummary.value = normalized;
    editText.value = normalized;
    reviewState.value = 'draft_generated';
  }

  function cancelEdit() {
    editText.value = draftSummary.value;
    reviewState.value = draftSummary.value ? 'draft_generated' : 'not_generated';
  }

  function acceptForSession() {
    if (!draftSummary.value || reviewState.value === 'rejected' || reviewState.value === 'accepted_for_export') {
      return;
    }
    reviewState.value = 'accepted_for_session';
  }

  function acceptForExport() {
    if (!draftSummary.value || reviewState.value === 'rejected') {
      return;
    }
    reviewState.value = 'accepted_for_export';
  }

  function rejectDraft() {
    if (!draftSummary.value) {
      return;
    }
    reviewState.value = 'rejected';
  }

  return {
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
  };
}
