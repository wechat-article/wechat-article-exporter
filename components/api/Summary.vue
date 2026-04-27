<script setup lang="ts">
import { sleep } from '#shared/utils/helpers';
import { request } from '#shared/utils/request';
import CodeSegment from '~/components/api/CodeSegment.vue';
import toastFactory from '~/composables/toast';
import type { GetAuthKeyResult } from '~/types/types';

const toast = toastFactory();

const loading = ref(false);
const apiKey = ref('');
async function getApiKey() {
  loading.value = true;
  try {
    await sleep(1000);
    const resp = await request<GetAuthKeyResult>(`/api/public/v1/authkey`);
    if (resp.code === 0) {
      apiKey.value = resp.data;
    } else {
      toast.error('获取 API 密钥失败', resp.msg);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div>
    <p>
      为了方便第三方开发人员进行个性化定制，本网站将其主要功能（包括但不限于公众号查询、历史文章列表查询、文章下载等）提供
      API 以供接入。
    </p>
    <p class="text-rose-500 font-medium mt-3">
      注意：目前接入 API 免费，后续会根据实际情况动态调整，不排除会改为收费模式。
    </p>
    <p class="text-rose-500 font-medium mt-1">如果你的调用量比较大的话，推荐进行私有部署。</p>

    <UAlert class="mt-10 mb-3">
      <template #title>
        <h3 class="font-medium text-xl flex items-center space-x-2">
          <UIcon name="i-lucide:key-square" />
          <span>密钥</span>
        </h3>
      </template>

      <template #description>
        <ol class="list-decimal pl-5 text-base">
          <!--          <li>-->
          <!--            <p>-->
          <!--              由于微信公众号本身的限制，密钥有效期最长为 4 天，且只能通过-->
          <!--              <span class="text-rose-500 font-medium">微信扫码</span> 获取。-->
          <!--            </p>-->
          <!--          </li>-->
          <li>
            <p>以下所有 <code>API</code> 如无特殊说明，均需要携带密钥进行调用。推荐通过以下方式传输：</p>
            <p>a. 通过自定义请求头 <code class="text-rose-500 font-medium font-mono">X-Auth-Key</code> 传递 API 密钥</p>
            <p>b. 已在本网站登录的浏览器环境可继续使用 name 为 <code class="text-rose-500 font-medium font-mono">auth-key</code> 的 Cookie</p>
          </li>
          <li>
            <p>
              <span
                >调用 API 的密钥由当前登录态签发，你在该网站扫码登录并保持会话有效时，可以随时重新生成或查询当前 API 密钥。</span
              >
            </p>
          </li>
          <li>
            <p>
              <span>由于该密钥与网站用的同一套体系，网站的登录信息失效时，对应的 API 密钥也将失效。</span>
            </p>
          </li>
        </ol>
        <UButton class="mt-3" color="blue" :loading="loading" @click="getApiKey">
          查询 API 密钥 (确保当前登录信息有效)
        </UButton>
        <div v-if="apiKey">
          <p class="mt-5 mb-2">当前 API 密钥:</p>
          <CodeSegment :code="apiKey" lang="text" class="max-w-xl" />
        </div>
      </template>
    </UAlert>
  </div>
</template>
