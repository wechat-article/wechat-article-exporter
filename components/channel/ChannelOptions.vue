<script setup lang="ts">
import type { SubscribeChannel } from '~/types/source';
import type { GetChannelListResponse } from '~/types/channel';
import toastFactory from '~/composables/toast';

const toast = toastFactory();

const value = defineModel<SubscribeChannel[]>('value', { default: [] });
const options = ref<SubscribeChannel[]>([]);

const loading = ref(false);

// 获取渠道列表
async function getChannelList() {
  loading.value = true;
  try {
    const resp = await $fetch<GetChannelListResponse>('/api/web/channel/list');
    if (resp.code === 0) {
      options.value = resp.data.map(item => ({
        id: item.id,
        name: item.name,
        type: item.type,
      }));
    } else {
      toast.error(resp.msg);
    }
  } catch (error: any) {
    console.error(error);
    toast.error('获取渠道配置失败', error.message);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getChannelList();
});
</script>

<template>
  <USelectMenu v-model="value" :options="options" by="id" multiple placeholder="请选择推送渠道">
    <template #label>
      <template v-if="value.length === 1">
        <span class="max-w-30 line-clamp-1">{{ value[0].name }}({{ value[0].type }})</span>
      </template>
      <template v-else-if="value.length > 1">
        <span>已选 {{ value.length }} 个渠道</span>
      </template>
    </template>
    <template #option="{ option: channel }">
      <p class="flex justify-between items-center">
        <span class="text-fuchsia-500 mr-3">{{ channel.type }}: </span>
        <span>{{ channel.name }}</span>
      </p>
    </template>
  </USelectMenu>
</template>
