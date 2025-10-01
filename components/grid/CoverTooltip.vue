<script setup lang="ts">
import type { ITooltipParams } from 'ag-grid-community';
interface Props {
  params: ITooltipParams;
}
defineProps<Props>();
</script>

<template>
  <img alt="" :src="params.value" style="max-width: 300px; max-height: 300px; object-fit: contain" />
</template>
