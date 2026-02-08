<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">公共代理</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- header -->
      <header class="px-4 py-5 sm:px-6">
        <div class="flex justify-between items-center mb-3">
          <h2 class="text-2xl font-semibold">统计信息</h2>

          <p class="font-serif font-bold">可用: {{ totalSuccess }}，不可用: {{ totalFailure }}</p>
        </div>
        <div class="flex justify-between items-center">
          <p class="text-rose-500 text-sm">
            警告: 公共代理资源有限，请合理使用。 若需抓取大量数据，请搭建自己的私有代理节点。<br />
            若发现某ip存在滥用公共代理从而导致官网无法使用，将有可能被封禁。<br />
          </p>
          <UPopover :popper="{ placement: 'left-start', arrow: true }">
            <UButton
              :icon="hasBlocked ? 'i-lucide:annoyed' : 'i-lucide:smile'"
              variant="link"
              :color="hasBlocked ? 'rose' : 'green'"
            />

            <template #panel>
              <div class="p-4 space-y-3 max-h-80 overflow-y-scroll">
                <div>
                  <p>当前IP:</p>
                  <code class="font-medium" :class="hasBlocked ? 'text-rose-500' : 'text-green-500'">
                    {{ currentIP }}
                  </code>
                </div>
                <div>
                  <p class="flex justify-between items-center min-w-64">
                    <span>已被封禁IP:</span>
                    <span class="text-xs text-gray-500">若存在误伤，请联系开发者</span>
                  </p>
                  <ul>
                    <li v-for="ip in blockedIPS" :key="ip">
                      <code class="text-rose-500">{{ ip }}</code>
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </header>

      <!-- 数据展示区 -->
      <div class="flex-1 px-4 py-5 sm:py-6 overflow-y-scroll">
        <div v-if="loading" class="flex justify-center items-center mt-5">
          <Loader :size="28" class="animate-spin text-slate-500" />
        </div>
        <ProxyMetrics :data="metricsData" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader } from 'lucide-vue-next';
import { request } from '#shared/utils/request';
import ProxyMetrics from '~/components/ProxyMetrics.vue';
import { websiteName } from '~/config';
import type { AccountMetric } from '~/types/proxy';

useHead({
  title: `公共代理 | ${websiteName}`,
});

const loading = ref(false);
const metricsData = ref<AccountMetric[]>([]);

const totalSuccess = computed(
  () => metricsData.value.filter(item => item.metric && item.metric.dailyRequests < 100_000).length
);
const totalFailure = computed(
  () => metricsData.value.filter(item => item.metric && item.metric.dailyRequests >= 100_000).length
);

async function getMetricsData() {
  loading.value = true;
  try {
    metricsData.value = await fetch('/api/web/worker/overview-metrics')
      .then(res => res.json())
      .catch(e => {
        throw e;
      });
  } catch (error) {
    console.error(error);
  } finally {
    loading.value = false;
  }
}

const currentIP = ref('');
const blockedIPS = ref<string[]>([]);

onMounted(async () => {
  await Promise.all([
    getMetricsData(),
    request('/api/web/misc/current-ip').then(data => {
      currentIP.value = data.ip;
    }),
    request<string[]>('/api/web/worker/blocked-ip-list').then(data => {
      blockedIPS.value = data;
    }),
  ]);
});
const hasBlocked = computed(() => {
  return blockedIPS.value.includes(currentIP.value);
});
</script>
