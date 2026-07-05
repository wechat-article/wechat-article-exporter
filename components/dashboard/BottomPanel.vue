<script setup lang="ts">
import { formatDistance } from 'date-fns';
import { request } from '#shared/utils/request';
import LoginModal from '~/components/modal/Login.vue';
import StorageUsage from '~/components/ui/StorageUsage.vue';
import toastFactory from '~/composables/toast';
import { IMAGE_PROXY } from '~/config';
import type { LogoutResponse } from '~/types/types';

const loginAccount = useLoginAccount();
const modal = useModal();
const toast = toastFactory();

const now = ref(new Date());
const distance = computed(() => {
  return (
    loginAccount.value &&
    formatDistance(new Date(loginAccount.value.expires), now.value, {
      includeSeconds: true,
      locale: {
        formatDistance: function (token, count, options) {
          if (now.value >= new Date(loginAccount.value.expires)) {
            window.clearInterval(timer);
            setTimeout(() => {
              loginAccount.value = null;
            }, 0);
            return '已过期';
          }

          switch (token) {
            case 'aboutXHours':
              return '大约' + count + '个小时';
            case 'aboutXMonths':
              return '大约' + count + '个月';
            case 'aboutXWeeks':
              return '大约' + count + '周';
            case 'aboutXYears':
              return '大约' + count + '年';
            case 'lessThanXMinutes':
              return '小于' + count + '分钟';
            case 'almostXYears':
              return '接近' + count + '年';
            case 'halfAMinute':
              return '半分钟';
            case 'lessThanXSeconds':
              return '小于' + count + '秒';
            case 'overXYears':
              return '超过' + count + '年';
            case 'xDays':
              return count + '天';
            case 'xHours':
              return count + '个小时';
            case 'xMinutes':
              return count + '分钟';
            case 'xMonths':
              return count + '个月';
            case 'xSeconds':
              return count + '秒';
            case 'xWeeks':
              return count + '周';
            case 'xYears':
              return count + '年';
            default:
              return 'unknown';
          }
        },
      },
    })
  );
});
const warning = computed(() => {
  const value = distance.value;
  return value === '已过期' || value.includes('分钟') || value.includes('秒');
});

function login() {
  modal.open(LoginModal);
}

const logoutBtnLoading = ref(false);

async function logout() {
  logoutBtnLoading.value = true;
  const { statusCode, statusText } = await request<LogoutResponse>('/api/web/mp/logout');
  if (statusCode === 200) {
    loginAccount.value = null;
  } else {
    toast.error('退出登录失败', statusText);
  }
  logoutBtnLoading.value = false;
}

let timer: number;
onMounted(() => {
  timer = window.setInterval(() => {
    now.value = new Date();
  }, 1000);
});
onUnmounted(() => {
  window.clearInterval(timer);
});
</script>

<template>
  <footer class="flex flex-col space-y-3 border-t border-cc-border pt-4 text-cc-muted">
    <div v-if="loginAccount" class="space-y-2">
      <div class="flex items-center space-x-2">
        <img
          v-if="loginAccount.avatar"
          :src="IMAGE_PROXY + loginAccount.avatar"
          alt=""
          class="rounded-full size-10 ring-1 ring-cc-border"
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
          class="border border-cc-border bg-white/40 text-cc-accent hover:bg-cc-danger hover:text-white disabled:opacity-60"
          @click="logout"
          >退出
        </UButton>
      </div>
      <div class="text-xs text-cc-muted">
        <span>会话剩余 </span>
        <span class="font-mono" :class="warning ? 'text-cc-danger' : 'text-cc-success'">{{
          distance
        }}</span>
      </div>
    </div>
    <div v-else>
      <UButton
        class="w-full justify-center border border-cc-border bg-white/45 text-cc-accent hover:bg-cc-accent hover:text-white"
        variant="solid"
        @click="login"
        >登录公众号</UButton
      >
    </div>
    <StorageUsage />
  </footer>
</template>
