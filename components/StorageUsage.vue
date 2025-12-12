<script setup lang="ts">
const runtimeConfig = useRuntimeConfig();
const useMysql = runtimeConfig.public.useMysql as boolean;

const usage = ref('');
const isLoading = ref(true);
const isError = ref(false);

function formatBytes(bytes: number): string {
  if (bytes < 1000) {
    return `${bytes} B`;
  } else if (bytes < 1000 ** 2) {
    return `${(bytes / 1000).toFixed(0)} kB`;
  } else if (bytes < 1000 ** 3) {
    return `${(bytes / 1000 ** 2).toFixed(1)} MB`;
  } else {
    return `${(bytes / 1000 ** 3).toFixed(2)} GB`;
  }
}

async function fetchLocalStorageUsage() {
  try {
    const storageUsage = await navigator.storage.estimate();
    const bytes = storageUsage.usage || 0;
    usage.value = formatBytes(bytes);
    isError.value = false;
  } catch (e) {
    console.error('Failed to get local storage usage:', e);
    usage.value = '未知';
    isError.value = true;
  }
  isLoading.value = false;
}

let timer: number;
onMounted(() => {
  // MySQL 模式下不显示存储占用统计
  if (useMysql) {
    isLoading.value = false;
    return;
  }
  
  fetchLocalStorageUsage();
  timer = window.setInterval(() => {
    fetchLocalStorageUsage();
  }, 1000);
});

onUnmounted(() => {
  if (timer) {
    window.clearInterval(timer);
  }
});
</script>

<template>
  <!-- MySQL 模式下不显示存储占用 -->
  <p v-if="!useMysql" class="text-sm">
    本地数据库占用约为 
    <span v-if="isLoading" class="text-gray-400">加载中...</span>
    <span v-else :class="isError ? 'text-orange-500' : 'text-rose-500'">{{ usage }}</span>
  </p>
</template>
