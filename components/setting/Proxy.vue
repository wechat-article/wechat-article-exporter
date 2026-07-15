<template>
  <UCard
    class="cc-settings-card"
    :ui="{
      ring: '',
      divide: 'divide-y divide-cc-border',
      header: { padding: 'px-5 py-4 sm:px-6' },
      body: { padding: 'px-5 py-5 sm:px-6' },
    }"
  >
    <template #header>
      <h3 class="text-xl font-semibold">代理节点</h3>
      <p class="text-sm text-cc-muted mt-1">
        <template v-if="docsWebsiteUrl">
          留空则使用
          <ExternalLink :href="docsWebsiteUrl + '/get-started/proxy.html'" text="公共代理" />
          。<ExternalLink :href="docsWebsiteUrl + '/get-started/private-proxy.html'" text="自建说明" />
        </template>
        <template v-else>
          留空则使用内置公共代理分配；可在此填写自建 http(s) 代理，每行一个绝对地址。
        </template>
      </p>
    </template>

    <div class="flex flex-col gap-6 lg:flex-row">
      <div class="cc-field flex-1">
        <label class="cc-field-label" for="proxy-list">代理地址</label>
        <textarea
          id="proxy-list"
          class="min-h-[220px] h-[min(400px,50vh)] w-full resize-none border border-cc-border bg-white/60 p-4 font-mono text-sm text-cc-text outline-none transition"
          v-model="textareaValue"
          spellcheck="false"
          placeholder="https://wproxy-01.deno.dev"
        ></textarea>
        <p class="cc-field-help">每行一个 http(s) 绝对地址；留空时使用公共代理分配。</p>
      </div>
      <div class="flex-1 flex-shrink-0 lg:max-w-sm">
        <p class="text-sm text-cc-muted leading-relaxed">
          须为 <code class="font-mono text-rose-600 dark:text-rose-400">http://</code> 或
          <code class="font-mono text-rose-600 dark:text-rose-400">https://</code> 绝对地址；调用时会自动拼接
          <code class="font-mono text-xs">?url=</code> 等参数。
        </p>
        <p class="cc-form-preview mt-4 px-3 py-2 text-sm">
          当前有效节点：
          <span class="font-mono text-cc-accent">{{ proxyList.length }}</span>
        </p>
        <UButton type="submit" @click="save" color="primary" class="mt-5 min-w-24 justify-center">{{
          saveBtnText
        }}</UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import ExternalLink from '~/components/base/ExternalLink.vue';
import { useCommercialConfig } from '~/composables/useCommercialConfig';
import type { Preferences } from '~/types/preferences';

const { docsWebsiteUrl } = useCommercialConfig();

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const textareaValue = ref('');
const proxyList = computed(() => {
  return textareaValue.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.startsWith('http'));
});

onMounted(() => {
  try {
    const configuredProxyList = (preferences.value as Preferences).privateProxyList;
    if (configuredProxyList.length > 0) {
      textareaValue.value = configuredProxyList.join('\n');
    }
  } catch (e) {}
});

const saveBtnText = ref('保存');
async function save() {
  saveBtnText.value = '保存成功';
  setTimeout(() => {
    (preferences.value as Preferences).privateProxyList = proxyList.value;
    saveBtnText.value = '保存';
  }, 1000);
}
</script>
