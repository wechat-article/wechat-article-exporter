import { describe, expect, it } from 'vitest';
import {
  createArticleSummaryReviewSnapshot,
  normalizeReviewSummaryText,
  useArticleSummaryReview,
} from '~/composables/useArticleSummaryReview';

describe('article summary review state', () => {
  it('normalizes review text for a bounded session draft', () => {
    const normalized = normalizeReviewSummaryText(`  公众号\n\n  文章\t摘要  ${'x'.repeat(1_100)}`);

    expect(normalized.startsWith('公众号 文章 摘要')).toBe(true);
    expect(normalized).toHaveLength(1_000);
  });

  it('creates a non-durable draft snapshot', () => {
    const snapshot = createArticleSummaryReviewSnapshot('draft_generated', '  待复核摘要  ');

    expect(snapshot).toEqual({
      state: 'draft_generated',
      draft: '待复核摘要',
      accepted: false,
      durableWriteAllowed: false,
    });
  });

  it('moves a generated summary through edit and accept states without durable writes', () => {
    const review = useArticleSummaryReview();

    review.loadDraft('  初始摘要  ');
    expect(review.reviewState.value).toBe('draft_generated');
    expect(review.reviewLabel.value).toBe('待人工复核');

    review.startEditing();
    expect(review.reviewState.value).toBe('editing');

    review.saveEdit('  人工复核后摘要  ');
    expect(review.draftSummary.value).toBe('人工复核后摘要');
    expect(review.reviewState.value).toBe('draft_generated');

    review.acceptForSession();
    expect(review.reviewState.value).toBe('accepted_for_session');
    expect(review.reviewSnapshot.value).toEqual({
      state: 'accepted_for_session',
      draft: '人工复核后摘要',
      accepted: true,
      durableWriteAllowed: false,
    });
  });

  it('allows explicit export acceptance with durable write metadata', () => {
    const review = useArticleSummaryReview();

    review.loadDraft('人工确认可导出摘要');
    review.acceptForExport();

    expect(review.reviewState.value).toBe('accepted_for_export');
    expect(review.reviewLabel.value).toBe('已允许 JSON 导出');
    expect(review.reviewSnapshot.value).toEqual({
      state: 'accepted_for_export',
      draft: '人工确认可导出摘要',
      accepted: true,
      durableWriteAllowed: true,
    });

    review.acceptForSession();
    expect(review.reviewState.value).toBe('accepted_for_export');

    review.startEditing();
    expect(review.reviewState.value).toBe('accepted_for_export');
  });

  it('rejects a draft and blocks later session acceptance until a new draft loads', () => {
    const review = useArticleSummaryReview();

    review.loadDraft('可退回摘要');
    review.rejectDraft();
    review.acceptForSession();

    expect(review.reviewState.value).toBe('rejected');
    expect(review.reviewSnapshot.value.accepted).toBe(false);
    expect(review.reviewSnapshot.value.durableWriteAllowed).toBe(false);

    review.loadDraft('重新生成摘要');
    expect(review.reviewState.value).toBe('draft_generated');
    expect(review.draftSummary.value).toBe('重新生成摘要');
  });
});
