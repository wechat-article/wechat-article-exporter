<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">公共代理</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- header -->
      <header class="flex justify-between items-center px-4 py-5 sm:px-6">
        <h2 class="text-2xl font-semibold">运行状况 <small class="text-gray-500 mx-3">最近 60 天</small></h2>

        <p class="font-serif font-bold">可用: {{ totalSuccess }}，不可用: {{ totalFailure }}</p>
      </header>

      <!-- 数据展示区 -->
      <div class="flex-1 px-4 py-5 sm:py-6 overflow-y-scroll">
        <div v-if="loading" class="flex justify-center items-center mt-5">
          <Loader :size="28" class="animate-spin text-slate-500" />
        </div>
        <ProxyStatus :data="monitorList" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResultProxyStatus } from '~/types/proxy';
import { Loader } from 'lucide-vue-next';
import { websiteName } from '~/config';

useHead({
  title: `公共代理 | ${websiteName}`,
});

const loading = ref(false);
const monitorList = ref<ResultProxyStatus[]>([]);

const totalSuccess = computed(() => monitorList.value.filter(item => item.currentStatus === 'up').length);
const totalFailure = computed(() => monitorList.value.filter(item => item.currentStatus === 'down').length);

async function getMonitorList() {
  loading.value = true;
  try {
    monitorList.value = await fetch('/api/web/misc/status').then(res => res.json());
  } catch (error) {
    console.log(error);
  } finally {
    loading.value = false;
  }
}
getMonitorList();
</script>
