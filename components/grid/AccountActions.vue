<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import { Loader } from 'lucide-vue-next';
import type { Ref } from 'vue';

interface Props {
  params: ICellRendererParams & {
    onSync?: (params: ICellRendererParams) => void;
    onStop?: (params: ICellRendererParams) => void;
    isDeleting: boolean | Ref<boolean>;
    isSyncing: boolean | Ref<boolean>;
    syncingRowId: string | null | Ref<string | null>;
  };
}
const props = defineProps<Props>();

function unwrap<T>(value: T | Ref<T>): T {
  return isRef(value) ? value.value : value;
}

function sync() {
  props.params.onSync && props.params.onSync(props.params);
}
function stop() {
  props.params.onStop && props.params.onStop(props.params);
}
const isDisabled = computed(() => unwrap(props.params.isDeleting) || unwrap(props.params.isSyncing));
const isLoading = computed(() => unwrap(props.params.isSyncing) && props.params.node.id === unwrap(props.params.syncingRowId));
</script>

<template>
  <div class="flex items-center justify-center gap-3">
    <UButton v-if="isLoading" color="green" size="xs" variant="solid" @click="stop">
      <Loader :size="14" class="animate-spin" />
      停止</UButton
    >
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
