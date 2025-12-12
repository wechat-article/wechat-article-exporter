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
  >
    <template #label>
      <UAvatar v-if="selected" :src="selected.round_head_img" size="2xs" />
      <span v-if="selected" class="max-w-30 line-clamp-1">{{ selected.nickname }}</span>
      <span v-if="selected" class="shrink-0">({{ selected.articles }}篇)</span>
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
import { getAllInfo, type Info } from '~/store/v2/info';

// 已缓存的公众号信息
const cachedAccountInfos = await getAllInfo();
const sortedAccountInfos = computed(() => {
  cachedAccountInfos.sort((a, b) => {
    return a.articles > b.articles ? -1 : 1;
  });
  return cachedAccountInfos;
});

const selected = defineModel<Info | undefined>();

// 自动选择第一个公众号 (文章数量最多的)，实现页面自动加载
// 使用 watchEffect + nextTick 确保在异步组件中正确初始化
watchEffect(() => {
  if (!selected.value && sortedAccountInfos.value.length > 0) {
    nextTick(() => {
      if (!selected.value) {
        selected.value = sortedAccountInfos.value[0];
      }
    });
  }
});
</script>
