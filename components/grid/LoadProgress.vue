<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
interface Props {
  params: ICellRendererParams;
}
const props = defineProps<Props>();

const count = ref(props.params.data.count);
const total = ref(props.params.data.total_count);

function refresh(params: ICellRendererParams): boolean {
  count.value = params.data.count;
  total.value = params.data.total_count;
  return true;
}
</script>

<template>
  <div class="mt-0">
    <UProgress color="sky" :value="count" :max="total" indicator />
  </div>
</template>
