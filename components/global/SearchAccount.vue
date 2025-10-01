<template>
  <USlideover v-model="isOpen" side="left" :ui="{ overlay: { background: 'bg-zinc-400/75' } }">
    <div
      class="rounded-lg divide-y divide-gray-100 dark:divide-gray-800 shadow bg-white dark:bg-gray-900 flex flex-col flex-1 overflow-y-scroll"
    >
      <div class="sticky top-0 bg-white py-4 px-2 shadow">
        <SearchAccountForm v-model="accountQuery" @search="searchAccount" />
      </div>
      <div class="flex-1">
        <ul class="divide-y antialiased">
          <li
            v-for="account in accountList"
            :key="account.fakeid"
            class="flex items-center px-2 py-4 hover:bg-slate-50 hover:cursor-pointer"
            :class="{ active: account.fakeid === activeAccount?.fakeid }"
            @click="selectAccount(account)"
          >
            <img class="size-20 mr-2" :src="account.round_head_img" alt="" />
            <div class="flex-1">
              <div class="flex justify-between">
                <p class="font-semibold">{{ account.nickname }}</p>
                <p class="text-sky-500 font-medium">
                  {{ ACCOUNT_TYPE[account.service_type] }}
                </p>
              </div>
              <p class="text-gray-500 text-sm">微信号: {{ account.alias || '未设置' }}</p>
              <p class="text-sm mt-2">{{ account.signature }}</p>
            </div>
          </li>
        </ul>

        <p v-if="loading" class="flex justify-center items-center my-2 py-2">
          <Loader :size="28" class="animate-spin text-slate-500" />
        </p>
        <p v-else-if="noMoreData" class="text-center mt-2 py-2 text-slate-400">已全部加载完毕</p>
        <button
          v-else-if="accountList.length > 0"
          @click="loadData"
          class="block mx-auto my-2 h-10 px-6 font-semibold rounded-md border border-slate-200 text-slate-900 dark:text-slate-300 hover:border-slate-400"
          type="button"
        >
          加载更多
        </button>
      </div>
    </div>
  </USlideover>
</template>

<script setup lang="ts">
import { ACCOUNT_LIST_PAGE_SIZE, ACCOUNT_TYPE } from '~/config';
import { Loader } from 'lucide-vue-next';
import { getAccountList } from '~/apis';
import type { AccountInfo } from '~/types/types';
import LoginModal from '~/components/modal/Login.vue';

const loginAccount = useLoginAccount();
const activeAccount = useActiveAccount();

const toast = useToast();
const modal = useModal();

const isOpen = ref(false);

function openSwitcher() {
  isOpen.value = true;
}

const accountQuery = ref('');
const accountList = reactive<AccountInfo[]>([]);
let begin = 0;

/**
 * 搜索公众号
 */
async function searchAccount() {
  begin = 0;
  accountList.length = 0;
  noMoreData.value = false;

  await loadData();
}

const loading = ref(false);
const noMoreData = ref(false);

/**
 * 加载公众号数据
 */
async function loadData() {
  loading.value = true;

  try {
    const [accounts, completed] = await getAccountList(loginAccount.value?.token, begin, accountQuery.value);
    accountList.push(...accounts);
    begin += ACCOUNT_LIST_PAGE_SIZE;
    noMoreData.value = completed;
  } catch (e: any) {
    if (e.message === 'session expired') {
      modal.open(LoginModal);
    } else {
      console.error(e);
      toast.add({
        color: 'rose',
        title: '错误',
        description: e.message,
        icon: 'i-octicon:bell-24',
      });
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 选择公众号
 * @param account
 */
function selectAccount(account: AccountInfo) {
  isOpen.value = false;
  emit('select:account', account);
}

const emit = defineEmits(['select:account']);

defineExpose({
  open: openSwitcher,
});
</script>
