<script setup lang="ts">
const usage = ref('');

async function init() {
  const storageUsage = await navigator.storage.estimate();
  const bytes = storageUsage.usage!;
  if (bytes < 1000) {
    usage.value = `${bytes} B`;
  } else if (bytes < 1000 ** 2) {
    usage.value = `${(bytes / 1000).toFixed(0)} kB`;
  } else if (bytes < 1000 ** 3) {
    usage.value = `${(bytes / 1000 ** 2).toFixed(1)} M`;
  } else {
    usage.value = `${(bytes / 1000 ** 3).toFixed(1)} G`;
  }
}

let timer: number;
onMounted(() => {
  timer = window.setInterval(() => {
    init();
  }, 1000);
});
onUnmounted(() => {
  window.clearInterval(timer);
});
</script>

<template>
  <p class="text-sm">
    本地数据库占用约为 <span class="text-rose-500">{{ usage }}</span>
  </p>
</template>
