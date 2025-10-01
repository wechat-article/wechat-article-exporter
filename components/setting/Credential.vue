<template>
  <UCard class="mx-4 mt-4">
    <template #header>
      <h3 class="text-2xl font-semibold">Credentials</h3>
      <p class="text-sm text-slate-10 font-serif">
        Credentials
        属于您的个人隐私，请勿告诉任何人。本网站也承诺不会泄露给除微信外的任何第三方，且仅用于获取文章留言数据及阅读量、点赞量、转发量、在看量数据。
      </p>
      <p class="text-sm text-rose-500 font-serif">注意：该数据的有效期较短(约30分钟)，请在导出文章的时候进行设置。</p>
      <p>
        <a :href="docsWebSite + '/advanced/credential.html'" target="_blank" class="underline text-blue-600 text-sm"
          >查看获取教程</a
        >
      </p>
      <p class="text-rose-500">
        注意：手动设置 Credentials 已经不再推荐，后续会逐渐废弃该方式，请参考
        <a target="_blank" class="underline text-blue-600" :href="docsWebSite + '/advanced/auto-detect-credential.html'"
          >自动获取 Credentials 教程</a
        >。
      </p>
    </template>

    <div class="flex space-x-10">
      <textarea
        class="h-[400px] flex-1 p-2 border rounded resize-none"
        spellcheck="false"
        v-model="url"
        @input="parseURL"
        placeholder="请粘贴拦截到的公众号文章URL，将会自动解析出相关参数。"
      />
      <UForm :schema="schema" :state="state" class="space-y-4 flex-1 flex-shrink-0" @submit="onSubmit">
        <UFormGroup label="__biz" name="__biz">
          <UInput v-model="state.__biz" placeholder="根据左边的URL自动解析 __biz" />
        </UFormGroup>
        <UFormGroup label="uin" name="uin">
          <UInput v-model="state.uin" placeholder="根据左边的URL自动解析 uin" />
        </UFormGroup>
        <UFormGroup label="key" name="key">
          <UInput v-model="state.key" placeholder="根据左边的URL自动解析 key" />
        </UFormGroup>
        <UFormGroup label="pass_ticket" name="pass_ticket">
          <UInput v-model="state.pass_ticket" placeholder="根据左边的URL自动解析 pass_ticket" />
        </UFormGroup>
        <UFormGroup label="wap_sid2" name="wap_sid2">
          <UInput v-model="state.wap_sid2" placeholder="请填写wap_sid2" />
        </UFormGroup>
        <div class="flex justify-between">
          <UButton
            type="submit"
            color="black"
            class="w-20 justify-center disabled:bg-slate-10"
            :disabled="saveBtnDisabled"
            >{{ saveBtnText }}</UButton
          >
          <p class="text-sm font-mono space-x-2" v-if="invalidStr">
            <span class="font-medium" :class="countdown.m >= 30 ? 'line-through' : ''"
              >获取时间: {{ invalidStr }}之前</span
            >
            <span v-if="countdown.m >= 30" class="text-rose-500">已失效</span>
          </p>
        </div>
      </UForm>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import { z } from 'zod';
import type { FormSubmitEvent } from '#ui/types';
import { docsWebSite } from '~/config';

const url = ref('');
function parseURL() {
  const matchResult = url.value.match(/(?<url>https:\/\/mp\.weixin\.qq\.com\/s\?\S+)/);
  if (matchResult && matchResult.groups && matchResult.groups.url) {
    const searchParams = new URL(matchResult.groups.url).searchParams;
    state.__biz = searchParams.get('__biz')!;
    state.uin = searchParams.get('uin')!;
    state.key = searchParams.get('key')!;
    state.pass_ticket = searchParams.get('pass_ticket')!;
    state.wap_sid2 = searchParams.get('wap_sid2')!;
    state.updatedAt = new Date().toLocaleString();
  }
}

const schema = z.object({
  __biz: z.string(),
  uin: z.string(),
  key: z.string(),
  pass_ticket: z.string(),
  wap_sid2: z.string(),
  updatedAt: z.string(),
});

type Schema = z.output<typeof schema>;

const state = reactive({
  __biz: '',
  uin: '',
  key: '',
  pass_ticket: '',
  wap_sid2: '',
  updatedAt: '',
});

const saveBtnDisabled = computed(() => !state.__biz || !state.uin || !state.key || !state.pass_ticket);
const countdown = reactive({
  m: 0,
  s: 0,
});
const invalidStr = computed(() => {
  let result = '';
  if (countdown.m > 0) {
    result += `${countdown.m}分`;
  }
  if (countdown.s > 0) {
    result += `${countdown.s}秒`;
  }
  return result;
});

let timer: number;

onMounted(() => {
  try {
    const credentials = JSON.parse(window.localStorage.getItem('credentials')!);
    state.__biz = credentials.__biz;
    state.uin = credentials.uin;
    state.pass_ticket = credentials.pass_ticket;
    state.key = credentials.key;
    state.wap_sid2 = credentials.wap_sid2;
    state.updatedAt = credentials.updatedAt;

    timer = window.setInterval(() => {
      if (state.updatedAt) {
        const seconds = Math.round((Date.now() - new Date(state.updatedAt).getTime()) / 1000);
        if (seconds >= 60) {
          countdown.s = seconds % 60;
          countdown.m = (seconds - countdown.s) / 60;
        } else {
          countdown.s = seconds;
          countdown.m = 0;
        }
      }
    }, 1000);
  } catch (e) {}
});
onBeforeUnmount(() => {
  window.clearInterval(timer);
});

const saveBtnText = ref('保存');
async function onSubmit(event: FormSubmitEvent<Schema>) {
  window.localStorage.setItem('credentials', JSON.stringify(event.data));
  saveBtnText.value = '保存成功';
  setTimeout(() => {
    saveBtnText.value = '保存';
  }, 1000);
}
</script>
