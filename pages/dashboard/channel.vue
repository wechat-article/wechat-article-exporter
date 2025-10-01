<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">渠道配置</h1>
    </Teleport>
    <div class="flex-1 flex-col h-full">
      <!-- 顶部操作区 -->
      <header class="flex items-center gap-3 px-3 py-3">
        <NewChannelDropdown
          @new:webhook="webhookModalRef!.add()"
          @new:dingding-bot="dingdingBotModalRef!.add()"
          @new:email="emailModalRef!.add()"
        />
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
          <template #type-data="{ row }">
            <span class="font-mono">{{ row.type }}</span>
          </template>
          <template #status-data="{ row }">
            <BaseTag v-if="row.status === 'normal'" color="green">正常</BaseTag>
            <BaseTag v-else color="red">异常</BaseTag>
          </template>
          <template #actions-data="{ row }">
            <UDropdown :items="rowAction(row)">
              <UButton color="gray" variant="ghost" icon="i-heroicons-ellipsis-horizontal-20-solid" />
            </UDropdown>
          </template>
        </UTable>
      </main>
    </div>

    <ConfigureWebhookModal ref="webhookModalRef" @submit="onSubmit" />
    <ConfigureDingdingBotModal ref="dingdingBotModalRef" @submit="onSubmit" />
    <ConfigureEmailModal ref="emailModalRef" @submit="onSubmit" />
  </div>
</template>

<script setup lang="ts">
import { websiteName } from '~/config';
import NewChannelDropdown from '~/components/channel/NewChannelDropdown.vue';
import ConfigureWebhookModal from '~/components/channel/ConfigureWebhookModal.vue';
import ConfigureDingdingBotModal from '~/components/channel/ConfigureDingdingBotModal.vue';
import ConfigureEmailModal from '~/components/channel/ConfigureEmailModal.vue';
import toastFactory from '~/composables/toast';
import type { ChannelConfig, GetChannelListResponse } from '~/types/channel';

useHead({
  title: `渠道配置 | ${websiteName}`,
});

const toast = toastFactory();

const webhookModalRef = ref<typeof ConfigureWebhookModal | null>(null);
const dingdingBotModalRef = ref<typeof ConfigureDingdingBotModal | null>(null);
const emailModalRef = ref<typeof ConfigureEmailModal | null>(null);

function onSubmit(data: ChannelConfig) {
  const target = sources.value.find(s => s.id === data.id);
  if (target) {
    Object.assign(target, data);
  } else {
    sources.value.push(data);
  }
}

const loading = ref(false);
const sources = ref<ChannelConfig[]>([]);

// 获取渠道列表
async function getChannelList() {
  loading.value = true;
  try {
    const resp = await $fetch<GetChannelListResponse>('/api/web/channel/list');
    if (resp.code === 0) {
      sources.value.push(...resp.data);
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

// 删除渠道
async function deleteChannel(channelId: string) {
  loading.value = true;
  try {
    const resp = await $fetch<GetChannelListResponse>('/api/web/channel/delete', {
      method: 'DELETE',
      query: {
        id: channelId,
      },
    });
    if (resp.code === 0) {
      sources.value = sources.value.filter(s => s.id !== channelId);
    } else {
      toast.error(resp.msg);
    }
  } catch (error: any) {
    console.error(error);
    toast.error('删除渠道配置失败', error.message);
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  getChannelList();
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
    key: 'type',
    label: '类型',
  },
  {
    key: 'status',
    label: '状态',
  },
  {
    key: 'actions',
    label: '操作',
  },
];

const rowAction = (row: ChannelConfig) => [
  [
    {
      label: '编辑',
      icon: 'i-heroicons-pencil-square-20-solid',
      click: () => {
        if (row.type === 'webhook') {
          webhookModalRef.value!.edit(row);
        } else if (row.type === '钉钉群机器人') {
          dingdingBotModalRef.value!.edit(row);
        } else if (row.type === '邮箱') {
          emailModalRef.value!.edit(row);
        } else {
          toast.error('渠道类型未识别', `仅支持「邮箱」/「钉钉群机器人」/「webhook」，当前类型 ${row.type}`);
        }
      },
    },
    {
      label: '删除',
      icon: 'i-heroicons-trash-20-solid',
      class: 'text-red-500',
      click: () => {
        deleteChannel(row.id);
      },
    },
  ],
];
</script>
