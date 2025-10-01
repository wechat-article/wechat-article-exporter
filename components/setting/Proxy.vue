<template>
  <UCard class="mx-4 mt-10">
    <template #header>
      <h3 class="text-2xl font-semibold">私有代理</h3>
      <p class="text-sm text-slate-10 font-serif">配置的私有代理地址仅供您本人使用</p>
      <p>
        <a
          :href="docsWebSite + '/get-started/private-proxy.html'"
          target="_blank"
          class="underline text-blue-600 text-sm"
          >如何搭建私有代理？</a
        >
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
        <div>
          <p>认证密钥：</p>
          <UInput
            placeholder="配置私有代理的认证密钥"
            v-model="preferences.privateProxyAuthorization"
            class="font-mono"
          />
        </div>
        <div class="my-5">
          <p>代理地址要求：</p>
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
