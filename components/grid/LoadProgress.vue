<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import { getAccountSyncStatusLabel, normalizeAccountSyncStatus } from '~/shared/utils/account-sync-status';

interface Props {
  params: ICellRendererParams;
}
const props = defineProps<Props>();

const count = ref(props.params.data.count);
const total = ref(Math.max(Number(props.params.data.total_count || 0), 1));
const status = ref(normalizeAccountSyncStatus(props.params.data.status));

const progressText = computed(() => {
  const baseText = getAccountSyncStatusLabel(status.value);
  if (status.value === 'success') {
    return `${baseText} · ${count.value}/${Math.max(total.value, count.value, 1)}`;
  }
  return baseText;
});

const progressTextClass = computed(() => {
  if (status.value === 'failed') return 'text-rose-600';
  if (status.value === 'success') return 'text-emerald-600';
  if (status.value === 'syncing') return 'text-amber-600';
  return 'text-slate-500';
});

function refresh(params: ICellRendererParams): boolean {
  count.value = params.data.count;
  total.value = Math.max(Number(params.data.total_count || 0), 1);
  status.value = normalizeAccountSyncStatus(params.data.status);
  return true;
}
</script>

<template>
  <div class="flex h-full w-full flex-col justify-center gap-1 overflow-hidden px-2 py-1">
    <UProgress class="w-full self-center" color="sky" :value="count" :max="total" />
    <div
      v-if="progressText"
      class="max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-center text-[11px] leading-4"
      :class="progressTextClass"
    >
      {{ progressText }}
    </div>
  </div>
</template>
