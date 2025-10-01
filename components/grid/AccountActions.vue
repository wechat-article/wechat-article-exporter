<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import { Loader } from 'lucide-vue-next';
interface Props {
  params: ICellRendererParams & {
    onSync?: (params: ICellRendererParams) => void;
    onStop?: (params: ICellRendererParams) => void;
    isDeleting: boolean;
    isSyncing: boolean;
    syncingRowId: string | null;
  };
}
const props = defineProps<Props>();

function sync() {
  props.params.onSync && props.params.onSync(props.params);
}
function stop() {
  props.params.onStop && props.params.onStop(props.params);
}
const isDisabled = computed(() => props.params.isDeleting || props.params.isSyncing);
const isLoading = computed(() => props.params.isSyncing && props.params.node.id === props.params.syncingRowId);
</script>

<template>
  <div class="flex items-center justify-center">
    <UButton v-if="isLoading" color="blue" size="xs" variant="solid" @click="stop">
      <Loader :size="14" class="animate-spin" />
      停止</UButton
    >
    <template v-else>
      <UButton
        v-if="isDisabled"
        icon="i-heroicons:arrow-path-rounded-square-20-solid"
        color="blue"
        size="xs"
        variant="solid"
        disabled
        class="disabled:opacity-35"
        @click="sync"
      ></UButton>
      <UTooltip v-else text="开始同步" :popper="{ placement: 'left' }">
        <UButton
          icon="i-heroicons:arrow-path-rounded-square-20-solid"
          color="blue"
          size="xs"
          variant="solid"
          @click="sync"
        ></UButton>
      </UTooltip>
    </template>
  </div>
</template>
