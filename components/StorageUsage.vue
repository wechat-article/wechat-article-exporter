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

async function fetchMysqlStorageUsage() {
  try {
    const response = await $fetch<{
      success: boolean;
      data: { totalBytes: number; message?: string };
      error?: string;
    }>('/api/db/storage-size');

    if (response.success) {
      if (response.data.message) {
        // 未登录或其他提示
        usage.value = response.data.message;
        isError.value = false;
      } else {
        usage.value = formatBytes(response.data.totalBytes);
        isError.value = false;
      }
    } else {
      console.error('Failed to get MySQL storage usage:', response.error);
      usage.value = '查询失败';
      isError.value = true;
    }
  } catch (e) {
    console.error('Failed to fetch MySQL storage usage:', e);
    usage.value = '连接失败';
    isError.value = true;
  }
  isLoading.value = false;
}

async function init() {
  if (useMysql) {
    await fetchMysqlStorageUsage();
  } else {
    await fetchLocalStorageUsage();
  }
}

let timer: number;
onMounted(() => {
  init();
  // MySQL 模式下降低刷新频率（5秒），本地存储保持1秒
  const interval = useMysql ? 5000 : 1000;
  timer = window.setInterval(() => {
    init();
  }, interval);
});

onUnmounted(() => {
  window.clearInterval(timer);
});
</script>

<template>
  <p class="text-sm">
    <template v-if="useMysql">
      MySQL 数据库占用约为 
    </template>
    <template v-else>
      本地数据库占用约为 
    </template>
    <span v-if="isLoading" class="text-gray-400">加载中...</span>
    <span v-else :class="isError ? 'text-orange-500' : 'text-rose-500'">{{ usage }}</span>
  </p>
</template>
