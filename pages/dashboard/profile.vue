<script setup lang="ts">
import { getSwitchAccountList, switchAccountApi } from '~/apis';
import type { ServiceBizListItem } from '~/types/types';
import { IMAGE_PROXY, websiteName } from '~/config';
import toastFactory from '~/composables/toast';
import { formatTimeStamp } from '~/utils';

useHead({
  title: `个人中心 | ${websiteName}`,
});

const { loggedIn, user, clear, openInPopup, session } = useUserSession();
const toast = toastFactory('i-lucide:squirrel');

const loginAccount = useLoginAccount();

const loading = ref(false);
const userList = shallowRef<ServiceBizListItem[]>([]);
async function getAccountList() {
  userList.value = [];
  try {
    loading.value = true;
    userList.value = await getSwitchAccountList(loginAccount.value.token);
  } catch (error: any) {
    console.warn(error.message);
    toast.error('发生错误', error.message);
  } finally {
    loading.value = false;
  }
}
const order_type_map: Record<number, string> = {
  1: '公众号',
  2: '小程序',
  3: '其他产品',
  8: '服务号',
};
const columns = [
  { key: 'headimgurl', label: '头像' },
  { key: 'nickname', label: '昵称' },
  { key: 'username', label: '用户名' },
  { key: 'order_type', label: '类型' },
  { key: 'is_admin', label: '角色' },
  { key: 'last_login_time', label: '最后登入时间' },
  { key: 'actions', label: '操作' },
];
const actions = (row: ServiceBizListItem) => [
  [
    {
      label: '登入',
      icon: 'i-lucide:log-in',
      click: () => {
        switchAccount(row);
      },
    },
  ],
];

onMounted(() => {
  getAccountList();
});

const managedMode = ref(false);
const switchingAccount = ref('');
async function switchAccount(user: ServiceBizListItem) {
  try {
    switchingAccount.value = user.username;

    loginAccount.value = await switchAccountApi(loginAccount.value.token, user.username);
    toast.success('账号切换成功', `已成功切换成 ${loginAccount.value.nickname}`);
  } catch (error: any) {
    console.warn(error);
    toast.error('发生错误', error.message);
  } finally {
    switchingAccount.value = '';
  }
}
</script>

<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">个人中心</h1>
    </Teleport>
    <div class="h-full overflow-y-scroll">
      <div class="flex flex-col p-5 space-y-10">
        <section v-if="loggedIn && user" class="flex flex-wrap gap-10">
          <UCard>
            <template #header>
              <h2 class="font-serif font-semibold text-2xl">用户信息</h2>
            </template>

            <template #default>
              <div class="flex items-center gap-3 relative">
                <img :alt="user.username" :src="user.avatar" class="size-20 rounded-full" />
                <UIcon
                  class="absolute right-0 -top-3 size-5"
                  v-if="user.provider === 'GitHub'"
                  name="i-logos:github-icon"
                />
                <UIcon
                  class="absolute right-0 -top-3 size-5"
                  v-if="user.provider === 'Google'"
                  name="i-logos:google-icon"
                />
                <div class="space-y-1">
                  <p class="font-mono">用户名: {{ user.username }}</p>
                  <p class="font-mono">邮箱: {{ user.email }}</p>
                  <p class="font-mono">
                    会员:
                    <UBadge
                      :ui="{ rounded: 'rounded-full' }"
                      :color="user.plan === 'pro' ? 'fuchsia' : 'gray'"
                      variant="subtle"
                      size="xs"
                      class="px-2 font-mono font-bold"
                      >{{ user.plan }}</UBadge
                    >
                  </p>
                </div>
              </div>
            </template>
          </UCard>
          <!--          <UCard>-->
          <!--            <template #header>-->
          <!--              <h2 class="font-serif font-semibold text-2xl">订阅源</h2>-->
          <!--            </template>-->
          <!--          </UCard>-->
        </section>
        <section>
          <h3 class="flex items-center font-serif font-semibold text-2xl mb-2">
            <span>公众号列表</span>
            <span class="flex-1"></span>
            <UCheckbox label="进入托管模式" color="blue" v-model="managedMode" />
            <UButton color="blue" :loading="loading" @click="getAccountList" class="ml-5">查询</UButton>
          </h3>
          <UTable
            :loading="loading"
            :rows="userList"
            :columns="columns"
            class="border rounded-md shadow-sm"
            :empty-state="{ icon: 'i-lucide:layers-3', label: '~~ 空空如也 ~~' }"
          >
            <!-- 头像 -->
            <template #headimgurl-data="{ row }">
              <UAvatar :src="IMAGE_PROXY + row.headimgurl" alt="Avatar" class="size-8 ring-1 ring-gray-300" />
            </template>

            <!-- 昵称 -->
            <template #nickname-data="{ row }">
              <div class="flex items-center gap-2">
                <template v-if="loginAccount.nickname === row.nickname">
                  <span class="font-semibold text-fuchsia-500">{{ row.nickname }}</span>
                  <UIcon class="text-fuchsia-400 size-5" name="i-lucide:sparkles" />
                </template>
                <span v-else class="font-semibold">{{ row.nickname }}</span>
              </div>
            </template>

            <!-- 角色 -->
            <template #is_admin-data="{ row }">
              <span v-if="row.is_admin === 1">管理员</span>
              <span v-else>运营者</span>
            </template>

            <!-- 最后登入时间 -->
            <template #last_login_time-data="{ row }">
              <span>{{ formatTimeStamp(row.last_login_time) }}</span>
            </template>

            <!-- 账号类型-->
            <template #order_type-data="{ row }">
              <span>{{ order_type_map[row.order_type] }}</span>
            </template>

            <!-- 操作-->
            <template #actions-data="{ row }">
              <UDropdown :items="actions(row)">
                <UButton
                  :disabled="managedMode || loginAccount.nickname === row.nickname"
                  color="gray"
                  variant="ghost"
                  icon="i-heroicons-ellipsis-horizontal-20-solid"
                />
              </UDropdown>
            </template>
          </UTable>
        </section>

        <!--      <section>-->
        <!--        <h3 class="font-semibold font-serif text-2xl">邮箱绑定</h3>-->
        <!--        <div>-->
        <!--          <UCard>-->
        <!--            <div v-if="loggedIn">-->
        <!--              <h1>Welcome, {{ user?.email || user?.name }}!</h1>-->
        <!--              <p>Logged in since {{ session?.loggedInAt }}</p>-->
        <!--              <button @click="logout">Logout</button>-->
        <!--            </div>-->
        <!--          </UCard>-->
        <!--        </div>-->
        <!--      </section>-->
      </div>
    </div>
  </div>
</template>

<style scoped>
.user.active .username {
  @apply text-fuchsia-500 font-medium;
}
</style>
