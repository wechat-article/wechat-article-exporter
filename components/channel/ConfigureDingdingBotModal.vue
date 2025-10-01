<template>
  <UModal v-model="open" prevent-close :ui="{ overlay: { background: 'bg-black/80' } }">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-medium">配置 钉钉群机器人</h2>
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
              <UInput v-model="state.name" placeholder="请输入渠道名称" />
            </UFormGroup>

            <UFormGroup size="lg" label="Webhook 地址" name="url" required help="输入 Webhook 地址">
              <UInput v-model="state.webhookUrl" placeholder="https://example.com/api/webhook" class="font-mono" />
            </UFormGroup>

            <UFormGroup size="lg" label="签名密钥" name="secret" help="留空表示不签名">
              <UInput v-model="state.secret" placeholder="请输入密钥" class="font-mono" />
            </UFormGroup>

            <section>
              <UAccordion :items="items">
                <template #item="{ item }">
                  <div class="space-y-3">
                    <UFormGroup size="lg" label="消息内容" name="text">
                      <UTextarea v-model="text" placeholder="请输入测试消息内容" />
                    </UFormGroup>
                    <UButton block :disabled="sendBtnDisabled" :loading="sendLoading" @click="send">发送</UButton>
                  </div>
                </template>
              </UAccordion>
            </section>

            <div class="space-y-4">
              <UButton :loading="submitBtnLoading" block class="mt-10 text-base" size="lg" color="blue" type="submit">
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
import { UniqueIdGenerator } from '~/utils/UniqueIDGenerator';
import { sendDingMessage } from '~/apis/channel';
import toastFactory from '~/composables/toast';
import type { ChannelConfig, SaveChannelResponse } from '~/types/channel';
import { urlIsValid } from '~/utils/validate';

const toast = toastFactory();

const open = defineModel<boolean>('open', { default: false });

const emit = defineEmits(['submit']);

// 表单验证
const validate = (state: ChannelConfig): FormError[] => {
  const errors = [];
  if (!state.name.trim()) errors.push({ path: 'name', message: '请填写渠道名称' });
  if (!state.webhookUrl!.trim()) {
    errors.push({ path: 'url', message: '请填写 Webhook 地址' });
  } else if (!urlIsValid(state.webhookUrl!.trim())) {
    errors.push({ path: 'url', message: 'Webhook 地址不合法' });
  }

  return errors;
};

const submitBtnLoading = ref(false);
async function onSubmit(event: FormSubmitEvent<any>) {
  const payload = JSON.parse(JSON.stringify(toRaw(event.data)));

  submitBtnLoading.value = true;
  try {
    const resp = await $fetch<SaveChannelResponse>('/api/web/channel/save', {
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

  emit('submit', payload);
  open.value = false;
}

// 定义初始状态
const getInitialState: () => ChannelConfig = () => ({
  id: UniqueIdGenerator.generateLongId(true),
  type: '钉钉群机器人',
  status: 'normal',
  name: '',
  webhookUrl: '',
  secret: '',
});

const state = reactive<ChannelConfig>(getInitialState());

function modalOpenInit() {
  text.value = '';
  sendLoading.value = false;
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

const items = [
  {
    label: '测试机器人',
    icon: 'i-heroicons-wrench-screwdriver',
    defaultOpen: false,
  },
];
const sendLoading = ref(false);
const sendBtnDisabled = computed(() => {
  return !text.value.trim() || !urlIsValid(state.webhookUrl!);
});
const text = ref('');
async function send() {
  sendLoading.value = true;
  sendDingMessage({
    webhookUrl: state.webhookUrl,
    secret: state.secret,
    payload: {
      msgtype: 'text',
      text: {
        content: text.value,
      },
    },
  })
    .then(resp => {
      if (resp.errcode === 0) {
        toast.success('消息发送成功！请检查群聊消息');
      } else {
        toast.error('消息发送失败', JSON.stringify(resp));
      }
    })
    .finally(() => {
      sendLoading.value = false;
    });
}
</script>
