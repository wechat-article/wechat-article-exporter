<script setup lang="ts">
import type { IStatusPanelParams } from 'ag-grid-community';

interface Props {
  params: IStatusPanelParams;
}
const props = defineProps<Props>();

const selectedRowCount = ref(0);
const totalRowCount = ref(0);

function refresh() {
  selectedRowCount.value = props.params.api.getSelectedRows().length;

  let count = 0;
  props.params.api.forEachLeafNode(() => {
    count++;
  });
  totalRowCount.value = count;
}

onMounted(() => {
  props.params.api.addEventListener('rowDataUpdated', refresh);
  props.params.api.addEventListener('selectionChanged', refresh);
  props.params.api.addEventListener('filterChanged', refresh);
  props.params.api.addEventListener('modelUpdated', refresh);
});

onUnmounted(() => {
  props.params.api.removeEventListener('rowDataUpdated', refresh);
  props.params.api.removeEventListener('selectionChanged', refresh);
  props.params.api.removeEventListener('filterChanged', refresh);
  props.params.api.removeEventListener('modelUpdated', refresh);
});
</script>

<template>
  <div class="flex items-center h-[40px] gap-3 font-mono font-semibold" v-if="totalRowCount > 0">
    <span class="text-green-500">已选 {{ selectedRowCount }}/{{ totalRowCount }}</span>
  </div>
</template>
