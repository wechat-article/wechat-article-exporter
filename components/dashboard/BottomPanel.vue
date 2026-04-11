<script setup lang="ts">
import { request } from '#shared/utils/request';
import LoginModal from '~/components/modal/Login.vue';
import StorageUsage from '~/components/StorageUsage.vue';
import { IMAGE_PROXY } from '~/config';
import type { LogoutResponse } from '~/types/types';

const loginAccount = useLoginAccount();
const modal = useModal();

const now = ref(new Date());
const distance = computed(() => {
  if (!loginAccount.value) return '';
  const expiresDate = new Date(loginAccount.value.expires);
  if (now.value >= expiresDate) {
    window.clearInterval(timer);
    setTimeout(() => {
      loginAccount.value = null;
    }, 0);
    return '已过期';
  }
  const remainMs = expiresDate.getTime() - now.value.getTime();
  const remainHours = remainMs / (1000 * 60 * 60);
  return `${remainHours.toFixed(1)} 小时`;
});
const warning = computed(() => {
  if (!loginAccount.value) return false;
  const expiresDate = new Date(loginAccount.value.expires);
  const remainMs = expiresDate.getTime() - now.value.getTime();
  return remainMs <= 0 || remainMs < 60 * 60 * 1000; // 小于1小时告警
});

function login() {
  modal.open(LoginModal);
}

const logoutBtnLoading = ref(false);

async function logout() {
  logoutBtnLoading.value = true;
  try {
    await request<LogoutResponse>('/api/web/mp/logout');
  } catch (e) {
    console.warn('登出请求失败:', e);
  }
  // 无论服务端是否成功，都清除本地登录状态
  loginAccount.value = null;
  logoutBtnLoading.value = false;
}

/** 从服务端获取最新 cookie 过期时间并更新前端 */
async function refreshCookieExpiry() {
  if (!loginAccount.value) return;
  try {
    const data = await request<{ valid: boolean; expiresAt: number | null }>('/api/web/worker/cookie-info');
    if (data.valid && data.expiresAt) {
      const serverExpires = new Date(data.expiresAt).toString();
      if (loginAccount.value.expires !== serverExpires) {
        loginAccount.value = { ...loginAccount.value, expires: serverExpires };
      }
      return;
    }

    loginAccount.value = null;
  } catch {
    // 静默忽略
  }
}

let timer: number;
let refreshTimer: number;
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
  // 每60秒从服务端同步cookie过期时间
  refreshCookieExpiry();
  refreshTimer = window.setInterval(refreshCookieExpiry, 60000);
});
onUnmounted(() => {
  window.clearInterval(timer);
  window.clearInterval(refreshTimer);
});
</script>

<template>
  <footer class="flex flex-col space-y-2 pt-3 border-t dark:border-slate-600">
    <div v-if="loginAccount" class="space-y-3">
      <div class="flex items-center space-x-2">
        <img
          v-if="loginAccount.avatar"
          :src="IMAGE_PROXY + loginAccount.avatar"
          alt=""
          class="rounded-full size-10 ring-1 ring-gray-300"
        />
        <UTooltip
          v-if="loginAccount.nickname"
          class="flex-1 overflow-hidden"
          :popper="{ placement: 'top-start', offsetDistance: 16 }"
        >
          <template #text>
            <span>{{ loginAccount.nickname }}</span>
          </template>
          <span class="whitespace-nowrap text-ellipsis overflow-hidden">{{ loginAccount.nickname }}</span>
        </UTooltip>

        <UButton
          icon="i-heroicons-arrow-left-start-on-rectangle-16-solid"
          :loading="logoutBtnLoading"
          class="bg-slate-10 hover:bg-rose-500 disabled:bg-rose-500"
          @click="logout"
          >退出
        </UButton>
      </div>
      <div class="text-sm">
        <span>登录信息过期时间还剩: </span>
        <span class="font-mono" :class="warning ? 'text-rose-500' : 'text-green-500'">{{ distance }}</span>
      </div>
    </div>
    <div v-else>
      <UButton color="gray" variant="solid" @click="login">登录公众号</UButton>
    </div>
    <StorageUsage />
  </footer>
</template>
