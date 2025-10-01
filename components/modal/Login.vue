<script setup lang="ts">
import { Loader, X } from 'lucide-vue-next';
import type { LoginAccount, ScanLoginResult, StartLoginResult } from '~/types/types';

const modal = useModal();

const qrcodeSrc = ref('');
const loading = ref(false);
const msg = ref('');

const checkTimer = ref<number | null>(null);

const loginAccount = useLoginAccount();

onMounted(() => {
  getQrcode();
});

function onClose() {
  modal.close();

  clearTimeout(checkTimer.value!);
  checkTimer.value = null;
}

/**
 * 创建新的登录会话
 *
 * 该请求会在response中设置一个唯一的uuid(cookie)作为会话id
 */
async function newLoginSession() {
  const sid = new Date().getTime().toString() + Math.floor(Math.random() * 100);
  const resp = await $fetch<StartLoginResult>(`/api/web/login/session/${sid}`, { method: 'POST' });
  if (!resp || !resp.base_resp || resp.base_resp.ret !== 0) {
    throw new Error(`${resp?.base_resp?.err_msg || '获取登录会话失败'}`);
  }
}

// 获取登录二维码
async function getQrcode() {
  try {
    loading.value = true;
    msg.value = '获取登录二维码';
    await newLoginSession();
    qrcodeSrc.value = `/api/web/login/getqrcode?rnd=${Math.random()}`;
    msg.value = '';

    // 启动计时器开始轮训检查
    _check();
  } catch (e: any) {
    msg.value = e.message;
    qrcodeSrc.value = 'https://placehold.co/320?text=qrcode';
  } finally {
    loading.value = false;
  }
}

function _check() {
  window.clearTimeout(checkTimer.value!);
  checkTimer.value = window.setTimeout(checkQrcodeStatus, 2000);
}

// 检查二维码扫描状态
async function checkQrcodeStatus() {
  const resp = await $fetch<ScanLoginResult>('/api/web/login/scan', {
    method: 'GET',
  });
  if (resp && resp.base_resp && resp.base_resp.ret === 0) {
    switch (resp.status) {
      case 0:
        _check();
        break;
      case 1:
        // 登录成功
        msg.value = '已确认，正在登录中';
        await bizLogin();
        break;
      case 2:
      case 3:
        // 刷新二维码
        qrcodeSrc.value = `/api/web/login/getqrcode?rnd=${Math.random()}`;
        _check();
        break;
      case 4:
      case 6:
        if (resp.acct_size >= 1) {
          loading.value = true;
          msg.value = '扫码成功，等待确认';
          qrcodeSrc.value = '';
        } else {
          msg.value = '没有可登录账号';
        }
        _check();
        break;
      case 5:
        // 未绑定邮箱，不能扫描登录
        msg.value = '该账号尚未绑定邮箱';
        _check();
        break;
    }
  }
}

async function bizLogin() {
  try {
    loading.value = true;
    const resp = await $fetch<LoginAccount>('/api/web/login/bizlogin', {
      method: 'POST',
    });
    if (resp.err) {
      throw new Error(`${resp.err}`);
    }

    msg.value = '登录成功';
    loginAccount.value = resp;

    onClose();
  } catch (e: any) {
    msg.value = e.message;
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <UModal prevent-close>
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">登录微信公众号</h2>
        <UButton square variant="link" color="gray" class="absolute right-3 top-3" @click="onClose">
          <X />
        </UButton>
      </template>

      <!-- 二维码图片展示区 -->
      <div class="flex flex-col justify-center items-center mx-auto size-80">
        <Loader v-if="loading" :size="28" class="animate-spin text-slate-500" />
        <p v-if="msg" class="text-rose-500">{{ msg }}</p>
        <img v-if="qrcodeSrc" :src="qrcodeSrc" alt="" class="w-full rounded-md" />
      </div>
    </UCard>
  </UModal>
</template>
