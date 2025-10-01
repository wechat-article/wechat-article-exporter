<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import { SquareCheckBig, Square } from 'lucide-vue-next';

interface Props {
  params: ICellRendererParams;
}
defineProps<Props>();
</script>

<template>
  <p v-if="params.node.group">
    <span>{{ params.value }}</span>
  </p>
  <p class="flex flex-wrap" v-else>
    <SquareCheckBig v-if="params.value" class="size-5 text-gray-400" />
    <Square v-else class="size-5 text-gray-400" />
  </p>
</template>
