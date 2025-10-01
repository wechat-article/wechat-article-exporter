<script setup lang="ts">
import { IMAGE_PROXY } from '~/config';
import StorageUsage from '~/components/StorageUsage.vue';
import { formatDistance } from 'date-fns';
import LoginModal from '~/components/modal/Login.vue';
import type { LogoutResponse } from '~/types/types';

const loginAccount = useLoginAccount();
const modal = useModal();

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
  const { statusCode, statusText } = await $fetch<LogoutResponse>(
    '/api/web/mp/logout?token=' + loginAccount.value.token
  );
  if (statusCode === 200) {
    loginAccount.value = null;
  } else {
    alert(statusText);
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
      <StorageUsage class="" />
    </div>
    <div v-else>
      <UButton color="gray" variant="solid" @click="login">登录公众号</UButton>
    </div>
  </footer>
</template>
