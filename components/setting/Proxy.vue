<template>
  <UCard class="mx-4 mt-10">
    <template #header>
      <h3 class="text-2xl font-semibold">代理节点</h3>
      <p class="text-sm text-slate-10 font-serif">
        若此处留空，则网站将使用
        <ExternalLink :href="docsWebSite + '/get-started/proxy.html'" text="公共代理" /> 进行资源下载。
      </p>
      <p>
        <ExternalLink :href="docsWebSite + '/get-started/private-proxy.html'" text="如何搭建代理节点？" />
      </p>
    </template>

    <div class="flex space-x-10">
      <textarea
        class="h-[400px] flex-1 p-2 border rounded resize-none font-mono"
        v-model="textareaValue"
        spellcheck="false"
        placeholder="请填写私有部署的代理地址，一行一个"
      ></textarea>
      <div class="flex-1 flex-shrink-0">
        <div class="my-5">
          <p>代理节点地址要求：</p>
          <ol>
            <li>
              <p>1. 以 <code class="text-rose-500 font-mono">http/https</code> 开头的绝对路径地址。</p>
              <p>
                2. 该地址在使用时后面会自动拼接
                <code class="text-rose-500 font-mono">?url=</code> 等参数，请确保格式正确。
              </p>
            </li>
          </ol>
          <p class="mt-3">代理示例：</p>
          <p><code class="text-rose-500 font-mono">https://wproxy-01.deno.dev</code></p>
          <p><code class="text-rose-500 font-mono">https://wproxy-01.deno.dev/</code></p>
        </div>
        <UButton type="submit" @click="save" color="black" class="w-20 mt-5 justify-center disabled:bg-slate-10">{{
          saveBtnText
        }}</UButton>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import ExternalLink from '~/components/base/ExternalLink.vue';
import { docsWebSite } from '~/config';
import type { Preferences } from '~/types/preferences';

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const textareaValue = ref('');
const proxyList = computed(() => {
  return textareaValue.value
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && line.startsWith('http'));
});

// 监听 preferences 中的代理列表变化（含 DB 异步加载完成后的回填）
watch(
  () => preferences.value.privateProxyList,
  (list) => {
    if (list && list.length > 0) {
      textareaValue.value = list.join('\n');
    }
  },
  { immediate: true },
);

const saveBtnText = ref('保存');
async function save() {
  (preferences.value as Preferences).privateProxyList = proxyList.value;
  saveBtnText.value = '保存成功';
  setTimeout(() => {
    saveBtnText.value = '保存';
  }, 1500);
}
</script>
