<template>
  <USelectMenu
    v-model="selected"
    size="md"
    color="gray"
    searchable
    searchable-placeholder="搜索公众号名称..."
    clear-search-on-close
    :options="sortedAccountInfos"
    option-attribute="nickname"
    placeholder="请选择公众号"
    multiple
  >
    <template #label>
      <span v-if="selected && selected.length > 0" class="line-clamp-1">
        已选择 {{ selected.length }} 个公众号
      </span>
      <span v-else>请选择公众号</span>
    </template>
    <template #option="{ option: account }">
      <UAvatar :src="account.round_head_img" size="sm" />
      <div>
        <p class="text-[16px]">{{ account.nickname }}</p>
        <p class="text-gray-500 text-sm">已加载文章数: {{ account.articles }}</p>
      </div>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import { getAllInfo, type MpAccount } from '~/store/v2/info';

// 已缓存的公众号信息
const cachedAccountInfos = await getAllInfo();
const sortedAccountInfos = computed(() => {
  cachedAccountInfos.sort((a, b) => {
    return a.articles > b.articles ? -1 : 1;
  });
  return cachedAccountInfos;
});

const selected = defineModel<MpAccount[]>({
  default: [],
});
</script>
