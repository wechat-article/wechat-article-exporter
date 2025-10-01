<script setup lang="ts">
import type { SubscribeAccount } from '~/types/source';
import toastFactory from '~/composables/toast';
import { IMAGE_PROXY } from '~/config';
import { getAllInfo } from '~/store/v2/info';

const toast = toastFactory();

const value = defineModel<SubscribeAccount[]>('value', { default: [] });
const options = ref<SubscribeAccount[]>([]);

const loading = ref(false);

// 获取公众号列表
async function getAccountList() {
  loading.value = true;
  try {
    const cachedAccountInfos = await getAllInfo();
    options.value = cachedAccountInfos.map(info => ({
      fakeid: info.fakeid,
      name: info.nickname!,
      avatar: info.round_head_img!,
    }));
  } catch (error: any) {
    console.error(error);
    toast.error('获取公众号列表失败', error.message);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getAccountList();
});
</script>

<template>
  <USelectMenu
    v-model="value"
    by="fakeid"
    size="lg"
    multiple
    searchable
    searchable-placeholder="搜索公众号名称..."
    clear-search-on-close
    :options="options"
    placeholder="请选择公众号"
  >
    <template #label>
      <template v-if="value.length === 1">
        <UAvatar :src="IMAGE_PROXY + value[0].avatar" size="2xs" />
        <span class="max-w-30 line-clamp-1">{{ value[0].name }}</span>
      </template>
      <template v-else-if="value.length > 1">
        <span>已选 {{ value.length }} 个公众号</span>
      </template>
    </template>
    <template #option="{ option: account }">
      <UAvatar :src="IMAGE_PROXY + account.avatar" size="sm" />
      <div>
        <p class="text-[16px]">{{ account.name }}</p>
      </div>
    </template>
  </USelectMenu>
</template>
