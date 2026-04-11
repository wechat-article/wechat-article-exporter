<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import type { Ref } from 'vue';

interface SyncStatus {
  stage: 'queued' | 'syncing' | 'exporting' | 'finalizing' | 'completed' | 'failed' | 'cancelled' | 'cancelling';
  pageNumber: number;
  currentArticleTitle: string | null;
  currentArticleIndex: number;
  currentArticleTotal: number;
  retrying: boolean;
  retryMessage: string | null;
}

interface Props {
  params: ICellRendererParams & {
    syncingRowId?: string | null | Ref<string | null>;
    syncStatus?: SyncStatus | null | Ref<SyncStatus | null>;
  };
}
const props = defineProps<Props>();

function unwrap<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value;
}

const count = ref(props.params.data.count);
const total = ref(props.params.data.total_count || Number.MAX_SAFE_INTEGER);

const currentSyncStatus = computed(() => unwrap(props.params.syncStatus ?? null));
const isCurrentRowSyncing = computed(() => props.params.node.id === unwrap(props.params.syncingRowId ?? null));

function displayPageNumber(pageNumber: number): number {
  return Math.max(1, Number(pageNumber || 0));
}

const progressText = computed(() => {
  if (!isCurrentRowSyncing.value || !currentSyncStatus.value) return '';

  const status = currentSyncStatus.value;
  if (status.retrying && status.retryMessage) {
    return status.retryMessage;
  }
  if (status.stage === 'exporting' && status.currentArticleTitle) {
    return `生成 ${status.currentArticleIndex}/${status.currentArticleTotal} ${status.currentArticleTitle}`;
  }
  if (status.stage === 'finalizing') {
    return '生成汇总文档';
  }
  if (status.stage === 'queued' || status.stage === 'syncing') {
    return `同步第 ${displayPageNumber(status.pageNumber)} 页`;
  }
  if (status.stage === 'cancelling') {
    return '正在取消';
  }
  return '';
});

const progressTextClass = computed(() => {
  if (!currentSyncStatus.value) return 'text-amber-600';
  if (currentSyncStatus.value.retrying) return 'text-orange-600';
  if (currentSyncStatus.value.stage === 'cancelling') return 'text-orange-500';
  return 'text-amber-600';
});

function refresh(params: ICellRendererParams): boolean {
  count.value = params.data.count;
  total.value = params.data.total_count || Number.MAX_SAFE_INTEGER;
  return true;
}
</script>

<template>
  <div class="flex min-h-[48px] w-full flex-col justify-center gap-1 overflow-hidden py-1">
    <UProgress color="sky" :value="count" :max="total" indicator />
    <div
      v-if="progressText"
      class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[11px] leading-4"
      :class="progressTextClass"
    >
      {{ progressText }}
    </div>
  </div>
</template>
