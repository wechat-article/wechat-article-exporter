<script setup lang="ts">
import { sleep } from '#shared/utils/helpers';
import { request } from '#shared/utils/request';
import CodeSegment from '~/components/api/CodeSegment.vue';
import toastFactory from '~/composables/toast';
import type { GetAuthKeyResult } from '~/types/types';

const toast = toastFactory();

// 会员/限速层配置（默认关闭；开启后才展示会员授权与限速说明）
const membership = useRuntimeConfig().public.membership;

const loading = ref(false);
const authKey = ref('');
async function getAuthKey() {
  loading.value = true;
  try {
    await sleep(1000);
    const resp = await request<GetAuthKeyResult>(`/api/public/v1/authkey`);
    if (resp.code === 0) {
      authKey.value = resp.data;
    } else {
      toast.error('获取密钥失败', resp.msg);
    }
  } finally {
    loading.value = false;
  }
}

const tiers = [
  { name: '查询类接口', desc: '搜索公众号 / 按链接搜索 / 文章列表', guest: '5 次/分钟', member: '100 次/分钟' },
  { name: '获取文章内容', desc: '文章下载 / 导出', guest: '1 次/分钟', member: '60 次/分钟' },
];

// 自助查询会员令牌详情
interface MemberInfo {
  status: 'valid' | 'expired' | 'notfound';
  expiresAt?: number;
  createdAt?: number | null;
  remainingDays?: number;
}

const memberToken = ref('');
const memberQuerying = ref(false);
const memberInfo = ref<MemberInfo | null>(null);

async function queryMemberInfo() {
  const tk = memberToken.value.trim();
  if (!tk) {
    toast.error('请输入令牌');
    return;
  }
  memberQuerying.value = true;
  memberInfo.value = null;
  try {
    memberInfo.value = await request<MemberInfo>('/api/public/v1/memberinfo', {
      headers: { 'X-Api-Token': tk },
    });
  } catch (e: any) {
    toast.error('查询失败', e?.data?.statusMessage || e?.data?.message || '请稍后重试');
  } finally {
    memberQuerying.value = false;
  }
}

function fmtDate(ms?: number | null) {
  // 固定东八区（北京时间），不随访问者本地时区变化
  return ms ? new Date(ms).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '-';
}
</script>

<template>
  <div class="space-y-8">
    <!-- 简介 -->
    <p class="text-base leading-relaxed text-gray-600 dark:text-gray-300">
      为了方便第三方开发人员进行个性化定制，本网站将其主要功能（包括但不限于公众号查询、历史文章列表查询、文章下载等）提供
      API 以供接入。
    </p>

    <!-- 计费提示（仅开启会员/限速时显示）-->
    <div
      v-if="membership.enabled"
      class="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/30"
    >
      <UIcon name="i-lucide:info" class="mt-0.5 size-5 shrink-0 text-amber-500" />
      <p class="text-sm text-amber-800 dark:text-amber-200">
        所有公开接口按调用频率分为<span class="font-semibold">「免费」</span>与<span class="font-semibold">「会员」</span
        >两档；开通会员（<span class="font-semibold">¥{{ membership.price }} / 天</span
        >）可大幅提升频率上限，详见下方「会员授权」。调用量很大的话，推荐私有部署。
      </p>
    </div>

    <!-- 密钥 -->
    <section class="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <h3 class="mb-4 flex items-center gap-2 text-xl font-semibold">
        <UIcon name="i-lucide:key-square" class="text-blue-500" />
        <span>密钥</span>
        <UBadge color="gray" variant="soft" size="xs" class="ml-1">登录集成 · 免费</UBadge>
      </h3>
      <ol class="list-decimal space-y-2 pl-5 text-sm leading-relaxed marker:text-gray-400">
        <li>
          查询类接口需携带密钥调用（下载接口无需）。密钥可通过两种方式传输：
          <div class="mt-1 space-y-0.5 text-gray-600 dark:text-gray-400">
            <p>a. 请求头 <code class="rounded bg-gray-100 px-1 font-mono text-rose-500 dark:bg-gray-800">X-Auth-Key</code></p>
            <p>
              b. name 为 <code class="rounded bg-gray-100 px-1 font-mono text-rose-500 dark:bg-gray-800">auth-key</code> 的
              Cookie
            </p>
          </div>
        </li>
        <li>密钥与本网站登录集成，扫码登录后会自动刷新。</li>
        <li>网站登录信息失效时，对应密钥同时失效。</li>
      </ol>
      <UButton class="mt-4" color="blue" :loading="loading" @click="getAuthKey">
        查询 API 密钥 (确保当前登录信息有效)
      </UButton>
      <div v-if="authKey" class="mt-4">
        <p class="mb-2 text-sm text-gray-500">当前密钥：</p>
        <CodeSegment :code="authKey" lang="text" class="max-w-xl" />
      </div>
    </section>

    <!-- 会员授权（付费，仅开启会员/限速时显示）-->
    <section v-if="membership.enabled" class="rounded-xl border border-gray-200 p-5 dark:border-gray-800">
      <h3 class="mb-4 flex items-center gap-2 text-xl font-semibold">
        <UIcon name="i-lucide:crown" class="text-amber-500" />
        <span>会员授权</span>
        <UBadge color="amber" variant="soft" size="xs" class="ml-1">付费</UBadge>
      </h3>

      <div class="grid gap-5 lg:grid-cols-3">
        <!-- 左：定价 + 频率对比 + 用法 -->
        <div class="space-y-4 lg:col-span-2">
          <!-- 定价 -->
          <div
            class="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-amber-50 to-amber-100/40 px-5 py-4 dark:from-amber-950/30 dark:to-amber-900/10"
          >
            <div>
              <p class="font-medium text-gray-800 dark:text-gray-100">开通会员 · 所有接口频率大幅提升</p>
              <p class="mt-0.5 text-sm text-gray-500">微信加好友，按天购买，随时开通</p>
            </div>
            <p class="shrink-0 text-3xl font-bold text-amber-600 dark:text-amber-400">
              ¥{{ membership.price }}<span class="text-base font-normal text-gray-400"> / 天</span>
            </p>
          </div>

          <!-- 频率对比表 -->
          <div class="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
            <table class="w-full text-sm">
              <thead class="bg-gray-50 text-xs text-gray-500 dark:bg-gray-900">
                <tr>
                  <th class="px-4 py-2.5 text-left font-medium">接口</th>
                  <th class="px-4 py-2.5 text-center font-medium">游客 · 免费</th>
                  <th class="px-4 py-2.5 text-center font-medium text-amber-600 dark:text-amber-400">
                  会员 · ¥{{ membership.price }}/天
                </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
                <tr v-for="t in tiers" :key="t.name">
                  <td class="px-4 py-3">
                    <p class="font-medium">{{ t.name }}</p>
                    <p class="mt-0.5 text-xs text-gray-400">{{ t.desc }}</p>
                  </td>
                  <td class="px-4 py-3 text-center text-gray-600 dark:text-gray-300">{{ t.guest }}</td>
                  <td class="px-4 py-3 text-center font-semibold text-amber-700 dark:text-amber-300">{{ t.member }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- 用法 -->
          <div class="space-y-1.5 text-sm">
            <p>
              会员调用时，在请求头携带专属令牌：<code
                class="rounded bg-gray-100 px-1 font-mono text-rose-500 dark:bg-gray-800"
                >X-Api-Token: 你的令牌</code
              >
            </p>
            <p class="text-gray-500">令牌按购买天数发放，到期后自动降级为游客速率。查询类接口仍需登录密钥（X-Auth-Key）。</p>
          </div>
        </div>

        <!-- 右：购买卡片 -->
        <div
          class="flex flex-col items-center rounded-xl border border-amber-200 bg-amber-50/40 p-5 text-center dark:border-amber-900/50 dark:bg-amber-950/20"
        >
          <p class="mb-3 text-sm font-medium">微信或QQ扫码加好友开通</p>
          <img :src="membership.qr" alt="会员二维码" class="size-40 rounded-lg border bg-white object-contain" />
          <p class="mt-3 text-xs text-gray-500">扫码加好友，备注「{{ membership.wechatNote }}」</p>
          <div class="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-gray-400">
            <span>加好友</span>
            <UIcon name="i-lucide:arrow-right" class="size-3" />
            <span>线下付款</span>
            <UIcon name="i-lucide:arrow-right" class="size-3" />
            <span>领取令牌</span>
          </div>
        </div>
      </div>

      <!-- 查询我的令牌 -->
      <div class="mt-5 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
        <p class="mb-2 flex items-center gap-2 text-sm font-medium">
          <UIcon name="i-lucide:search" class="size-4 text-gray-400" />
          查询我的令牌
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UInput
            v-model="memberToken"
            placeholder="粘贴你的会员令牌 (X-Api-Token)"
            class="flex-1"
            @keyup.enter="queryMemberInfo"
          />
          <UButton color="amber" :loading="memberQuerying" @click="queryMemberInfo">查询</UButton>
        </div>

        <div v-if="memberInfo" class="mt-3 text-sm">
          <template v-if="memberInfo.status === 'valid'">
            <p class="flex items-center gap-1.5 font-medium text-green-600 dark:text-green-400">
              <UIcon name="i-lucide:badge-check" class="size-4" />会员有效
            </p>
            <div class="mt-1.5 space-y-0.5 text-gray-600 dark:text-gray-300">
              <p>剩余天数：<span class="font-medium">{{ memberInfo.remainingDays }}</span> 天</p>
              <p>到期时间：{{ fmtDate(memberInfo.expiresAt) }} <span class="text-xs text-gray-400">北京时间</span></p>
              <p v-if="memberInfo.createdAt">开通时间：{{ fmtDate(memberInfo.createdAt) }}</p>
            </div>
          </template>
          <template v-else-if="memberInfo.status === 'expired'">
            <p class="flex items-center gap-1.5 font-medium text-rose-500">
              <UIcon name="i-lucide:alert-triangle" class="size-4" />会员已过期
            </p>
            <div class="mt-1.5 space-y-0.5 text-gray-600 dark:text-gray-300">
              <p>到期时间：{{ fmtDate(memberInfo.expiresAt) }} <span class="text-xs text-gray-400">北京时间</span></p>
              <p class="text-rose-500">请续费后恢复会员额度。</p>
            </div>
          </template>
          <template v-else>
            <p class="flex items-center gap-1.5 font-medium text-gray-500">
              <UIcon name="i-lucide:x-circle" class="size-4" />未找到该令牌（无效或已过期清理）
            </p>
          </template>
        </div>
      </div>
    </section>
  </div>
</template>
