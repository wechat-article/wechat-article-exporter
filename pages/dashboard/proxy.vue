<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-xl font-semibold text-cc-text">公共代理</h1>
    </Teleport>

    <div class="cc-page-frame flex flex-col h-full">
      <!-- header -->
      <header class="cc-page-toolbar px-4 py-3 sm:px-6">
        <div class="flex flex-wrap justify-between items-center gap-2 mb-2">
          <h2 class="text-lg font-semibold">统计</h2>
          <p class="text-sm tabular-nums text-cc-text">
            可用 {{ totalSuccess }} · 不可用 {{ totalFailure }}
          </p>
        </div>
        <div class="flex flex-wrap items-start gap-3 justify-between">
          <p class="text-xs text-cc-muted max-w-2xl leading-relaxed">
            公共代理额度有限，大量抓取请自建代理。滥用可能导致当前 IP 被封；额度每日 8:00 刷新。
          </p>
          <UPopover :popper="{ placement: 'left-start', arrow: true }">
            <UButton
              :icon="hasBlocked ? 'i-heroicons-face-frown-20-solid' : 'i-heroicons-face-smile-20-solid'"
              variant="soft"
              size="sm"
              square
              :color="hasBlocked ? 'rose' : 'green'"
              aria-label="当前 IP 与封禁列表"
            />

            <template #panel>
              <div class="p-3 space-y-3 max-h-80 overflow-y-auto text-sm">
                <div>
                  <p class="text-xs text-cc-muted mb-1">当前 IP</p>
                  <code class="font-mono text-xs" :class="hasBlocked ? 'text-rose-500' : 'text-green-600'">{{
                    currentIP
                  }}</code>
                </div>
                <div>
                  <p class="text-xs text-cc-muted mb-1">封禁列表（误伤请联系开发者）</p>
                  <ul class="font-mono text-xs">
                    <li v-for="ip in blockedIPS" :key="ip">
                      <code class="text-rose-600">{{ ip }}</code>
                    </li>
                  </ul>
                </div>
              </div>
            </template>
          </UPopover>
        </div>
      </header>

      <!-- 数据展示区 -->
      <div class="flex-1 px-4 py-3 sm:py-4 overflow-y-scroll">
        <div v-if="loading" class="flex justify-center items-center mt-5">
          <Loader :size="28" class="animate-spin text-cc-muted" />
        </div>
        <ProxyMetrics :data="metricsData" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Loader } from 'lucide-vue-next';
import { request } from '#shared/utils/request';
import ProxyMetrics from '~/components/ui/ProxyMetrics.vue';
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
    request<{ ips: string[] } | string[]>('/api/web/worker/blocked-ip-list').then(data => {
      blockedIPS.value = Array.isArray(data) ? data : data.ips || [];
    }),
  ]);
});
const hasBlocked = computed(() => {
  return blockedIPS.value.includes(currentIP.value);
});
</script>
