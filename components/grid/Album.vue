<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
interface Props {
  params: ICellRendererParams;
}
defineProps<Props>();
</script>

<template>
  <p class="flex flex-wrap" v-if="!params.node.group">
    <span v-for="album in params.data.appmsg_album_infos" :key="album.id" class="text-blue-600 mr-2"
      >#{{ album.title }}</span
    >
  </p>
</template>
