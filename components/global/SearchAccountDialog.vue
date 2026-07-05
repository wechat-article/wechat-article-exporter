<template>
  <USlideover v-model="isOpen" side="left" :ui="{ overlay: { background: 'bg-neutral-950/45 backdrop-blur-sm' } }">
    <div class="cc-account-drawer divide-y divide-cc-border shadow-xl flex flex-col flex-1 overflow-y-scroll">
      <div class="sticky top-0 z-10 bg-white/95 py-4 px-3 shadow-sm backdrop-blur">
        <SearchAccountForm v-model="accountQuery" @search="searchAccount" />
      </div>
      <div class="flex-1">
        <ul class="divide-y antialiased">
          <li
            v-for="account in accountList"
            :key="account.fakeid"
            class="cc-account-row flex items-center px-3 py-4 hover:cursor-pointer"
            @click="selectAccount(account)"
          >
            <img class="size-16 mr-3 rounded-md border border-cc-border object-cover" :src="account.round_head_img" alt="" />
            <div class="flex-1">
              <div class="flex justify-between">
                <p class="font-semibold">{{ account.nickname }}</p>
                <p class="text-cc-accent font-medium">
                  {{ ACCOUNT_TYPE[account.service_type] }}
                </p>
              </div>
              <p class="text-cc-muted text-sm">微信号: {{ account.alias || '未设置' }}</p>
              <p class="text-sm mt-2 text-cc-text">{{ account.signature }}</p>
            </div>
          </li>
        </ul>

        <p v-if="loading" class="flex justify-center items-center my-2 py-2">
          <Loader :size="28" class="animate-spin text-cc-muted" />
        </p>
        <p v-else-if="noMoreData" class="text-center mt-2 py-2 text-cc-muted">已全部加载完毕</p>
        <button
          v-else-if="accountList.length > 0"
          @click="loadData"
          class="block mx-auto my-3 h-10 rounded-md border border-cc-border bg-white px-6 font-semibold text-cc-text transition hover:border-cc-border-strong"
          type="button"
        >
          加载更多
        </button>
      </div>
    </div>
  </USlideover>
</template>

<script setup lang="ts">
import { Loader } from 'lucide-vue-next';
import { getAccountList } from '~/apis';
import LoginModal from '~/components/modal/Login.vue';
import { ACCOUNT_LIST_PAGE_SIZE, ACCOUNT_TYPE } from '~/config';
import type { AccountInfo } from '~/types/types';

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
    const [accounts, completed] = await getAccountList(begin, accountQuery.value);
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
