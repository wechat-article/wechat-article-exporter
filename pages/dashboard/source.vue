<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">订阅源管理</h1>
    </Teleport>
    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部操作区 -->
      <header class="flex items-center gap-3 px-3 py-3">
        <UButton square color="blue" icon="i-lucide:plus" @click="subscribeModalRef!.add()" />
      </header>

      <!-- 数据表格 -->
      <main class="flex-1 px-4 py-5 sm:py-6 overflow-y-scroll">
        <UTable
          :loading="loading"
          :rows="sources"
          :columns="columns"
          :empty-state="{ icon: 'i-lucide:layers-3', label: '~~空空如也~~' }"
          class="border rounded-md"
        >
          <template #id-data="{ row }">
            <span class="font-mono">{{ row.id }}</span>
          </template>
          <template #name-data="{ row }">
            <span>{{ row.name }}</span>
          </template>
          <template #accounts-data="{ row }">
            <span>{{ row.accounts.length }}</span>
          </template>
          <template #channels-data="{ row }">
            <span>{{ row.channels.map(channel => channel.type) }}</span>
          </template>
          <template #enabled-data="{ row }">
            <BaseTag v-if="row.enabled" color="green">启用</BaseTag>
            <BaseTag v-else color="red">禁用</BaseTag>
          </template>
          <template #actions-data="{ row }">
            <UDropdown :items="rowAction(row)">
              <UButton color="gray" variant="ghost" icon="i-heroicons-ellipsis-horizontal-20-solid" />
            </UDropdown>
          </template>
        </UTable>
      </main>
    </div>

    <ConfigureSubscribeModal ref="subscribeModalRef" @submit="onSubmit" />
  </div>
</template>

<script setup lang="ts">
import ConfigureSubscribeModal from '~/components/channel/ConfigureSubscribeModal.vue';
import { websiteName } from '~/config';
import toastFactory from '~/composables/toast';
import type { GetSourceListResponse, SubscribeSourceConfig, SaveSourceResponse } from '~/types/source';

useHead({
  title: `订阅源管理 | ${websiteName}`,
});

const toast = toastFactory();

const subscribeModalRef = ref<typeof ConfigureSubscribeModal | null>(null);

function onSubmit(data: SubscribeSourceConfig) {
  const target = sources.value.find(item => item.id === data.id);
  if (target) {
    Object.assign(target, data);
  } else {
    sources.value.push(data);
  }
}

const loading = ref(false);
const sources = ref<SubscribeSourceConfig[]>([]);

// 获取订阅源列表
async function getSourceList() {
  loading.value = true;
  try {
    const resp = await $fetch<GetSourceListResponse>('/api/web/source/list');
    if (resp.code === 0) {
      sources.value = resp.data;
    } else {
      toast.error(resp.msg);
    }
  } catch (error: any) {
    console.error(error);
    toast.error('获取订阅源配置失败', error.message);
  } finally {
    loading.value = false;
  }
}

// 删除订阅源
async function deleteSource(sourceId: string) {
  loading.value = true;
  try {
    const resp = await $fetch<SaveSourceResponse>('/api/web/source/delete', {
      method: 'DELETE',
      query: {
        id: sourceId,
      },
    });
    if (resp.code === 0) {
      await getSourceList();
    } else {
      toast.error(resp.msg);
    }
  } catch (error: any) {
    console.error(error);
    toast.error('删除订阅源失败', error.message);
  } finally {
    loading.value = false;
  }
}

// 修改订阅源
async function saveSource(payload: SubscribeSourceConfig) {
  loading.value = true;
  try {
    const resp = await $fetch<SaveSourceResponse>('/api/web/source/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (resp.code !== 0) {
      toast.error('配置保存失败', resp.msg);
      return;
    }
    await getSourceList();
  } catch (e: any) {
    toast.error('配置保存失败', e.message);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getSourceList();
});

const columns = [
  {
    key: 'id',
    label: 'ID',
  },
  {
    key: 'name',
    label: '名称',
  },
  {
    key: 'accounts',
    label: '公众号数量',
  },
  {
    key: 'cron',
    label: '抓取策略',
  },
  {
    key: 'channels',
    label: '推送方式',
  },
  {
    key: 'enabled',
    label: '状态',
  },
  {
    key: 'actions',
    label: '操作',
  },
];

const rowAction = (row: SubscribeSourceConfig) => [
  [
    {
      label: '编辑',
      icon: 'i-heroicons-pencil-square-20-solid',
      click: () => {
        subscribeModalRef.value!.edit(row);
      },
    },
    {
      label: row.enabled ? '禁用' : '启用',
      icon: 'i-heroicons:power-16-solid',
      click: () => {
        row.enabled = !row.enabled;
        saveSource(row);
      },
    },
    {
      label: '删除',
      icon: 'i-heroicons-trash-20-solid',
      class: 'text-red-500',
      click: () => {
        deleteSource(row.id);
      },
    },
  ],
];
</script>
