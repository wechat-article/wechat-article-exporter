<template>
  <UModal v-model="open" prevent-close :ui="{ overlay: { background: 'bg-black/80' } }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-medium">配置订阅源</h2>
          <UButton
            color="gray"
            variant="ghost"
            icon="i-heroicons-x-mark-20-solid"
            class="-my-1"
            @click="open = false"
          />
        </div>
      </template>
      <template #default>
        <div>
          <UForm :validate="validate" :state="state" class="space-y-6" @submit="onSubmit">
            <UFormGroup size="lg" label="名称" name="name" required>
              <UInput v-model="state.name" placeholder="请输入订阅源名称" />
            </UFormGroup>

            <UFormGroup size="lg" label="状态" name="enabled">
              <UToggle v-model="state.enabled" />
            </UFormGroup>

            <UFormGroup size="lg" label="公众号" name="accounts" required>
              <AccountOptions v-model:value="state.accounts" />
            </UFormGroup>

            <UFormGroup size="lg" label="更新策略" name="cron" required>
              <UInput v-model="state.cron" placeholder="请输入 cron 表达式" />
            </UFormGroup>

            <UFormGroup size="lg" label="推送渠道" name="channels" required>
              <ChannelOptions v-model:value="state.channels" />
            </UFormGroup>

            <div class="space-y-4">
              <UButton block :loading="submitBtnLoading" class="mt-10 text-base" size="lg" color="blue" type="submit">
                提交
              </UButton>
            </div>
          </UForm>
        </div>
      </template>
    </UCard>
  </UModal>
</template>

<script setup lang="ts">
import type { FormError, FormSubmitEvent } from '#ui/types';
import ChannelOptions from '~/components/channel/ChannelOptions.vue';
import AccountOptions from '~/components/channel/AccountOptions.vue';
import toastFactory from '~/composables/toast';
import type { SaveSourceResponse, SubscribeSourceConfig } from '~/types/source';
import { UniqueIdGenerator } from '~/utils/UniqueIDGenerator';

const toast = toastFactory();

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits(['submit']);

// 表单验证
const validate = (state: SubscribeSourceConfig): FormError[] => {
  const errors = [];
  if (!state.name.trim()) errors.push({ path: 'name', message: '请填写订阅源名称' });
  if (!state.accounts || state.accounts.length === 0) errors.push({ path: 'accounts', message: '至少选择一个公众号' });
  if (!state.cron) {
    errors.push({ path: 'cron', message: 'cron表达式不正确' });
  }
  if (state.channels.length === 0) {
    errors.push({ path: 'channels', message: '至少选择一个推送渠道' });
  }
  return errors;
};

const submitBtnLoading = ref(false);
async function onSubmit(event: FormSubmitEvent<any>) {
  const payload = JSON.parse(JSON.stringify(toRaw(event.data)));

  submitBtnLoading.value = true;
  try {
    const resp = await $fetch<SaveSourceResponse>('/api/web/source/save', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (resp.code !== 0) {
      toast.error('配置保存失败', resp.msg);
      return;
    }
  } catch (e: any) {
    toast.error('配置保存失败', e.message);
  } finally {
    submitBtnLoading.value = false;
  }
  console.log(payload);

  emit('submit', payload);
  open.value = false;
}

// 定义初始状态
const getInitialState: () => SubscribeSourceConfig = () => ({
  id: UniqueIdGenerator.generateLongId(true),
  name: '',
  enabled: false,
  accounts: [],
  cron: '',
  channels: [],
});

const state = reactive<SubscribeSourceConfig>(getInitialState());

function modalOpenInit() {
  open.value = true;
}

// 新增
function add() {
  modalOpenInit();
  Object.assign(state, getInitialState());
}

// 编辑
function edit(data: any) {
  modalOpenInit();
  Object.assign(state, data);
}

defineExpose({
  add,
  edit,
});
</script>
