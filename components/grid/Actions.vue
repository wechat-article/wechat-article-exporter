<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
interface Props {
  params: ICellRendererParams & {
    onGotoLink?: (params: ICellRendererParams) => void;
    onPreview?: (params: ICellRendererParams) => void;
  };
}
const props = defineProps<Props>();

function gotoLink() {
  props.params.onGotoLink && props.params.onGotoLink(props.params);
}
function preview() {
  props.params.onPreview && props.params.onPreview(props.params);
}
</script>

<template>
  <div class="flex items-center justify-center">
    <UTooltip text="访问原文" :popper="{ placement: 'top' }">
      <UButton icon="i-heroicons-link-16-solid" color="blue" square variant="ghost" @click="gotoLink" />
    </UTooltip>
    <UTooltip text="预览" :popper="{ placement: 'top' }">
      <UButton
        :disabled="!params.data.contentDownload || params.data.downloading"
        icon="i-heroicons:fire-16-solid"
        color="blue"
        square
        variant="ghost"
        @click="preview"
      />
    </UTooltip>
  </div>
</template>
