<script setup lang="ts">
import { request } from '#shared/utils/request';

const usage = ref('');

async function init() {
  try {
    const data = await request<{ bytes: number }>('/api/web/worker/db-size');
    const bytes = data.bytes;
    if (bytes < 1000) {
      usage.value = `${bytes} B`;
    } else if (bytes < 1000 ** 2) {
      usage.value = `${(bytes / 1000).toFixed(0)} kB`;
    } else if (bytes < 1000 ** 3) {
      usage.value = `${(bytes / 1000 ** 2).toFixed(1)} MB`;
    } else {
      usage.value = `${(bytes / 1000 ** 3).toFixed(2)} GB`;
    }
  } catch {
    usage.value = '获取失败';
  }
}

onMounted(() => {
  init();
  // 每 30 秒刷新一次（DB 大小不需要频繁刷新）
  const timer = window.setInterval(init, 30000);
  onUnmounted(() => window.clearInterval(timer));
});
</script>

<template>
  <p class="text-sm">
    本地数据库占用约为 <span class="text-rose-500">{{ usage }}</span>
  </p>
</template>
