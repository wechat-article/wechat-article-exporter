<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import { Loader } from 'lucide-vue-next';
import type { Ref } from 'vue';
import { normalizeAccountSyncStatus } from '~/shared/utils/account-sync-status';

interface GridManualSyncJobStatus {
  jobId: string;
  stage: 'queued' | 'syncing' | 'exporting' | 'finalizing' | 'completed' | 'failed' | 'cancelled' | 'cancelling';
}

interface Props {
  params: ICellRendererParams & {
    onSync?: (params: ICellRendererParams) => void;
    onCancelSync?: (params: ICellRendererParams) => void;
    isDeleting: boolean | Ref<boolean>;
  };
}
const props = defineProps<Props>();

function unwrap<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value;
}

function sync() {
  props.params.onSync && props.params.onSync(props.params);
}

function cancelSync() {
  props.params.onCancelSync && props.params.onCancelSync(props.params);
}

const rowStatus = computed(() => normalizeAccountSyncStatus(props.params.data.status));
const manualSyncJob = computed<GridManualSyncJobStatus | null>(() => props.params.data.manualSyncJob || null);
const isDisabledAccount = computed(() => props.params.data.is_delete === true);
const manualStage = computed(() => manualSyncJob.value?.stage || null);
const isQueued = computed(() => manualStage.value === 'queued' || (!manualStage.value && rowStatus.value === 'queued'));
const isLoading = computed(() => {
  return manualStage.value === 'syncing'
    || manualStage.value === 'exporting'
    || manualStage.value === 'finalizing'
    || (!manualStage.value && rowStatus.value === 'syncing');
});
const isCancelling = computed(() => manualStage.value === 'cancelling');
const canCancel = computed(() => {
  return manualStage.value === 'queued'
    || manualStage.value === 'syncing'
    || manualStage.value === 'exporting'
    || manualStage.value === 'finalizing'
    || manualStage.value === 'cancelling';
});
const isDisabled = computed(() => unwrap(props.params.isDeleting) || isDisabledAccount.value || isQueued.value || isLoading.value);
</script>

<template>
  <div class="flex items-center justify-center gap-3">
    <UButton v-if="isDisabledAccount" color="gray" size="xs" variant="soft" disabled>
      已禁用
    </UButton>
    <UButton v-else-if="canCancel" color="rose" size="xs" variant="soft" :loading="isCancelling" @click="cancelSync">
      {{ isCancelling ? '取消中' : '取消' }}
    </UButton>
    <UButton v-else-if="isLoading" color="amber" size="xs" variant="soft" disabled>
      <Loader :size="14" class="animate-spin" />
      同步中</UButton
    >
    <UButton v-else-if="isQueued" icon="i-lucide:clock-3" color="gray" size="xs" variant="soft" disabled>
      排队中
    </UButton>
    <UButton
      v-else
      icon="i-heroicons:arrow-path-rounded-square-20-solid"
      color="blue"
      size="xs"
      :disabled="isDisabled"
      @click="sync"
    ></UButton>
  </div>
</template>
