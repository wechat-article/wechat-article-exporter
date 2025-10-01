<template>
  <USelectMenu
    v-model="selected"
    size="md"
    color="gray"
    multiple
    searchable
    searchable-placeholder="搜索公众号名称..."
    clear-search-on-close
    :options="sortedAccountInfos"
    option-attribute="nickname"
    placeholder="请选择公众号"
  >
    <template #label>
      <template v-if="selected.length === 1">
        <UAvatar :src="IMAGE_PROXY + selected[0].round_head_img" size="2xs" />
        <span class="max-w-30 line-clamp-1">{{ selected[0].nickname }}</span>
        <span class="shrink-0">({{ selected[0].articles }}篇)</span>
      </template>
      <template v-else-if="selected.length > 1">
        <span>已选 {{ selected.length }} 个公众号 (共{{ totalArticleCount }}篇)</span>
      </template>
    </template>
    <template #option="{ option: account }">
      <UAvatar :src="IMAGE_PROXY + account.round_head_img" size="sm" />
      <div>
        <p class="text-[16px]">{{ account.nickname }}</p>
        <p class="text-gray-500 text-sm">已加载文章数: {{ account.articles }}</p>
      </div>
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import { getAllInfo, type Info } from '~/store/v2/info';
import { IMAGE_PROXY } from '~/config';

// 已缓存的公众号信息
const cachedAccountInfos = await getAllInfo();
const sortedAccountInfos = computed(() => {
  cachedAccountInfos.sort((a, b) => {
    return a.articles > b.articles ? -1 : 1;
  });
  return cachedAccountInfos;
});

const selected = defineModel<Info[]>({ default: [] });
const totalArticleCount = computed(() => {
  return selected.value.reduce((acc, cur) => {
    return acc + cur.articles;
  }, 0);
});
</script>
