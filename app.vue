<template>
  <div
    :class="isDev ? 'debug-screens' : ''"
    class="cc-app-shell flex flex-col h-screen bg-cc-app text-cc-text"
  >
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <UNotifications />
    <UModals />
  </div>
</template>

<script setup lang="ts">
import { isDev } from '~/config';
import { isChromeBrowser } from '~/utils';

const toast = useToast();

onMounted(() => {
  if (!isChromeBrowser()) {
    toast.add({
      title: '浏览器提示',
      description: '为了更好的用户体验，推荐使用 Chrome 浏览器。',
      color: 'orange',
      icon: 'i-heroicons-information-circle-20-solid',
      timeout: 8000,
    });
  }
});
</script>

<style>
@import 'style.css';
</style>
