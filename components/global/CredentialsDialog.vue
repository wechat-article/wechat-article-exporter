<template>
  <USlideover v-model="open" :ui="{ width: 'max-w-[500px]' }">
    <UCard
      class="flex flex-col flex-1"
      :ui="{ body: { base: 'flex-1' }, ring: '', divide: 'divide-y divide-gray-100 dark:divide-gray-800' }"
    >
      <template #header>
        <div class="flex justify-between items-center">
          <h2 class="font-bold text-2xl">抓取 Credentials</h2>
        </div>
      </template>

      <div>
        <UTabs
          :items="tabs"
          :ui="{ list: { marker: { background: 'bg-blue-500 text-white' }, tab: { active: 'text-white' } } }"
        >
          <template #item="{ item }">
            <div v-if="item.key === 'wxdown'" class="space-y-5">
              <p class="flex items-center text-sm">
                <span class="text-rose-500 font-semibold">所需软件：</span>
                <UButton @click="downloadProgram" variant="ghost" color="gray"
                  >去下载 wxdown-service 程序
                  <UIcon name="i-lucide:arrow-up-right" class="size-5" />
                </UButton>
              </p>
              <div class="flex justify-between items-center gap-3">
                <UInput
                  class="flex-1"
                  color="gray"
                  type="url"
                  v-model="wsURL"
                  :disabled="monitoring || wsMonitoring"
                  placeholder="请输入 ws 监听地址"
                />
                <UButton
                  v-if="!wsMonitoring"
                  :disabled="!wsURL || monitoring"
                  color="blue"
                  @click="startListenService(true)"
                >
                  开始监控
                </UButton>
                <UButton v-else icon="i-line-md:loading-twotone-loop" color="green" @click="stopListenService"
                  >监控中，结束监控</UButton
                >
              </div>
            </div>
            <div v-if="item.key === 'mitmproxy'">
              <p class="flex items-center text-sm">
                <span class="text-rose-500 font-semibold">所需软件：</span>
                <UButton @click="downloadPlugin" variant="ghost" color="gray"
                  >去下载 mitmproxy 插件
                  <UIcon name="i-lucide:arrow-up-right" class="size-5" />
                </UButton>
              </p>
              <div class="text-sm my-5">
                <p class="flex justify-between items-end">执行以下命令启动 mitmproxy 服务并加载 credential.py 插件：</p>
                <p class="flex justify-between items-center bg-black text-white p-2 my-2 rounded-md">
                  <code>mitmdump -s credential.py -q</code>
                  <UIcon v-if="copied" name="i-lucide:copy-check" />
                  <UIcon
                    v-else
                    name="i-lucide:copy"
                    class="cursor-pointer"
                    @click="copy('mitmdump -s credential.py -q')"
                  />
                </p>
              </div>
              <div class="flex justify-between items-center gap-3">
                <UInput
                  class="flex-1"
                  color="gray"
                  v-model="apiKey"
                  :disabled="authorized || wsMonitoring"
                  placeholder="请输入API Key"
                />
                <UButton
                  class="px-5"
                  color="blue"
                  :loading="authorizeBtnLoading"
                  :disabled="!apiKey || authorized || wsMonitoring || monitoring"
                  @click="authorize"
                  >认证</UButton
                >

                <UButton v-if="!monitoring" :disabled="!authorized || wsMonitoring" color="blue" @click="start"
                  >开始监控</UButton
                >
                <UButton v-else icon="i-line-md:loading-twotone-loop" color="green" @click="stop"
                  >监控中，结束监控</UButton
                >
              </div>
            </div>
          </template>
        </UTabs>
        <ul class="flex flex-col mt-3 p-1 gap-4 overflow-y-scroll h-[calc(100vh-20rem)] no-scrollbar">
          <li
            v-for="credential in credentials"
            :key="credential.biz"
            class="relative flex items-center border rounded-md hover:ring ring-blue-500 hover:shadow-md transition-all duration-300 p-3 space-x-5"
          >
            <div class="size-20 border rounded-full">
              <img :src="credential.avatar" alt="" />
            </div>
            <div class="flex-1">
              <p>公众号名称：{{ credential.nickname || '--' }}</p>
              <p>fakeid: {{ credential.biz }}</p>
              <p>获取时间: {{ credential.time }}</p>
              <div class="flex items-center justify-between mt-4">
                <span v-if="credential.valid" class="font-sans font-bold text-green-500">有效</span>
                <span v-else class="font-sans font-bold text-rose-500">已过期</span>
                <UButton
                  size="xs"
                  :color="credential.added ? 'green' : 'blue'"
                  :variant="credential.added ? 'soft' : 'solid'"
                  :disabled="credential.added || addingBiz === credential.biz"
                  :loading="addingBiz === credential.biz"
                  @click="addAccount(credential)"
                >
                  {{ credential.added ? '已添加' : '添加公众号' }}
                </UButton>
              </div>
            </div>
            <UButton
              v-if="isDev"
              :loading="pullArticleLoading"
              class="absolute top-3 right-3"
              @click="pullData(credential.biz)"
            >
              拉取数据
            </UButton>
          </li>
        </ul>
      </div>
    </UCard>
  </USlideover>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import { getArticleList, getArticleListWithCredential } from '~/apis';
import LoginModal from '~/components/modal/Login.vue';
import toastFactory from '~/composables/toast';
import useLoginCheck from '~/composables/useLoginCheck';
import { CREDENTIAL_API_HOST, CREDENTIAL_LIVE_MINUTES, isDev } from '~/config';
import { getInfoCache, type MpAccount } from '~/store/v2/info';
import type { ParsedCredential } from '~/types/credential';

export type CredentialState = 'active' | 'inactive' | 'warning';

const emit = defineEmits<{
  (e: 'update:pendingCount', value: number): void;
}>();

const open = defineModel<boolean>('open', { default: false });
const state = defineModel<CredentialState>('state', { default: 'inactive' });

const pullArticleLoading = ref(false);
async function pullData(fakeid: string) {
  pullArticleLoading.value = true;
  const articles = await getArticleListWithCredential(fakeid);
  console.log(articles);
  pullArticleLoading.value = false;
}

const tabs = [
  {
    key: 'wxdown',
    label: 'wxdown 程序版',
  },
  {
    key: 'mitmproxy',
    label: 'mitmproxy 插件版',
  },
];

const { checkLogin } = useLoginCheck();

const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);
for (const item of credentials.value) {
  item.valid = Date.now() < item.timestamp + 1000 * 60 * CREDENTIAL_LIVE_MINUTES;
}
const validCredentialCount = computed(() => credentials.value.filter(c => c.valid).length);
const pendingCredentialCount = computed(() => credentials.value.filter(c => c.valid && !c.added).length);
const toast = toastFactory();
const modal = useModal();

const addingBiz = ref<string | null>(null);

/**
 * 从 set_cookie 字符串中解析 appmsg_token 和完整 cookie 字符串
 * set_cookie 格式: "name=value; Path=/; HttpOnly, name2=value2; Path=/; HttpOnly, ..."
 */
function parseSetCookie(setCookie: string): { appmsg_token: string; cookie: string } {
  let appmsg_token = '';
  const tokenMatch = setCookie.match(/appmsg_token=(?<token>[^;]+)/);
  if (tokenMatch?.groups?.token) {
    appmsg_token = decodeURIComponent(tokenMatch.groups.token.trim());
  }

  // 按逗号分隔各 cookie 条目，提取有效的 name=value 对
  const cookieParts: string[] = [];
  const entries = setCookie.split(',');
  for (const entry of entries) {
    const nameValue = entry.trim().split(';')[0].trim();
    if (!nameValue || !nameValue.includes('=')) continue;
    // 跳过 EXPIRED 值和纯属性条目
    if (nameValue.includes('EXPIRED')) continue;
    const name = nameValue.split('=')[0].trim();
    if (['Path', 'Expires', 'HttpOnly', 'Secure', 'Domain', 'SameSite'].includes(name)) continue;
    // 跳过空值（如 rewardsn=）
    const value = nameValue.split('=').slice(1).join('=');
    if (!value) continue;
    cookieParts.push(nameValue);
  }

  return { appmsg_token, cookie: cookieParts.join('; ') };
}

async function refreshCredentialAddedState() {
  const pending = credentials.value.map(async credential => {
    const info = await getInfoCache(credential.biz);
    credential.added = Boolean(info);
  });
  await Promise.allSettled(pending);
}

// 监听账号事件，及时更新当前凭据项的按钮状态
const { accountEventBus } = useAccountEventBus();
accountEventBus.on((event, payload) => {
  if (event === 'account-added') {
    const target = credentials.value.find(item => item.biz === payload?.fakeid);
    if (target) {
      target.added = true;
    }
  } else if (event === 'account-removed') {
    const target = credentials.value.find(item => item.biz === payload?.fakeid);
    if (target) {
      target.added = false;
    }
  }
});

interface Credential {
  url: string;
  set_cookie: string;
  timestamp: number;
  name: string;
  avatar: string;
}

let timer: number;
let manulStopped = false;
let listenRetryTimer: number | null = null;
const monitoring = ref(JSON.parse(localStorage.getItem('auto-detect-credentials:monitoring') as string) || false);

function start() {
  monitoring.value = true;
  const oldTimer = localStorage.getItem('auto-detect-credentials:monitoring-timer');
  if (oldTimer) {
    window.clearInterval(parseInt(oldTimer));
  }
  fetchCredentials();
  timer = window.setInterval(() => {
    fetchCredentials();
  }, 3000);
  localStorage.setItem('auto-detect-credentials:monitoring', 'true');
  localStorage.setItem('auto-detect-credentials:monitoring-timer', timer.toString());
}
function stop() {
  monitoring.value = false;
  localStorage.setItem('auto-detect-credentials:monitoring', 'false');
  window.clearInterval(timer);
}

// 监听服务重试机制
function scheduleListenRetry() {
  if (listenRetryTimer) {
    window.clearTimeout(listenRetryTimer);
  }

  // 如果是手动停止的，则不重试
  if (manulStopped) return;

  listenRetryTimer = window.setTimeout(() => {
    startListenService();
  }, 5000);
}

// 清除重试定时器
function clearRetryTimer() {
  if (listenRetryTimer) {
    window.clearTimeout(listenRetryTimer);
    listenRetryTimer = null;
  }
}

onMounted(() => {
  if (monitoring.value) {
    start();
  }
  refreshCredentialAddedState();
  startListenService();
});

onUnmounted(() => {
  clearRetryTimer();
});

// 下载 credential.py 插件
async function downloadPlugin() {
  const link = document.createElement('a');
  link.href = '/plugins/credential.py';
  link.download = 'credential.py';
  link.click();
}

// 下载 wxdown-service 程序
async function downloadProgram() {
  const link = document.createElement('a');
  link.target = '_blank';
  link.href = 'https://github.com/wechat-article/wxdown-service/releases';
  link.download = 'wxdown-service';
  link.click();
}

const apiKey = ref(localStorage.getItem('auto-detect-credentials:apikey') as string);
const authorizeBtnLoading = ref(false);
const authorized = ref(false);

// 认证
async function authorize() {
  try {
    authorizeBtnLoading.value = true;
    const response = await fetch(`${CREDENTIAL_API_HOST}/authorize`, {
      method: 'GET',
      headers: {
        Authorization: apiKey.value,
      },
    });
    if (response.status === 200) {
      authorized.value = true;
      localStorage.setItem('auto-detect-credentials:apikey', apiKey.value);
      alert('认证成功');
    } else {
      authorized.value = false;
      localStorage.removeItem('auto-detect-credentials:apikey');
      alert('认证失败，请确认 API Key 是否正确');
    }
  } catch (error: any) {
    if (error.message === 'Failed to fetch') {
      alert('mitmproxy 服务未启动');
    } else {
      alert(error.message);
    }
    authorized.value = false;
  } finally {
    authorizeBtnLoading.value = false;
  }
}

// 获取数据
async function fetchCredentials() {
  let result: Credential[] = [];
  try {
    const response = await fetch(`${CREDENTIAL_API_HOST}/credentials`, {
      method: 'GET',
      headers: {
        Authorization: apiKey.value,
      },
    });
    if (response.status === 404) {
      result = [];
    } else if (response.status !== 200) {
      authorized.value = false;
      stop();
      return;
    } else {
      result = await response.json();
    }
  } catch (error) {
    console.error(error);
    authorized.value = false;
    stop();
    return;
  }

  const _credentials: ParsedCredential[] = [];
  for (const item of result) {
    const searchParams = new URL(item.url).searchParams;
    const __biz = searchParams.get('__biz')!;
    const uin = searchParams.get('uin')!;
    const key = searchParams.get('key')!;
    const pass_ticket = searchParams.get('pass_ticket')!;

    let wap_sid2 = null;
    const matchResult = item.set_cookie.match(/wap_sid2=(?<wap_sid2>.+?);/);
    if (matchResult && matchResult.groups && matchResult.groups.wap_sid2) {
      wap_sid2 = matchResult.groups.wap_sid2;
    }

    const { appmsg_token, cookie } = parseSetCookie(item.set_cookie);

    // 验证完整性
    if (!__biz || !uin || !key || !pass_ticket || !wap_sid2) {
      continue;
    }

    const info = await getInfoCache(__biz);
    _credentials.push({
      nickname: item.name || info?.nickname,
      avatar: item.avatar || info?.round_head_img,
      biz: __biz,
      uin: uin,
      key: key,
      pass_ticket: pass_ticket,
      wap_sid2: wap_sid2,
      appmsg_token: appmsg_token,
      cookie: cookie,
      timestamp: item.timestamp,
      time: dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss'),
      valid: Date.now() < item.timestamp + 1000 * 60 * CREDENTIAL_LIVE_MINUTES,
      added: Boolean(info),
    });
  }
  credentials.value = _credentials.sort((a, b) => b.timestamp - a.timestamp);
}

const wsURL = ref('ws://127.0.0.1:65001');
const wsMonitoring = ref(false);
let _ws: WebSocket | null = null;

// 启动监听服务
async function startListenService(isManual = false) {
  const url = wsURL.value.trim();
  if (!url) {
    return;
  }
  if (isManual) {
    // 手动启动时，取消手动停止标记
    manulStopped = false;
  }
  const ws = new WebSocket(url);
  ws.addEventListener('open', () => {
    wsMonitoring.value = true;
    _ws = ws;
    clearRetryTimer();
  });
  ws.addEventListener('message', async evt => {
    let result = [];
    try {
      result = JSON.parse(evt.data);
    } catch (e) {
      console.warn('解析失败: ', e);
    }
    const _credentials: ParsedCredential[] = [];
    for (const item of result) {
      const searchParams = new URL(item.url).searchParams;
      const __biz = searchParams.get('__biz')!;
      const uin = searchParams.get('uin')!;
      const key = searchParams.get('key')!;
      const pass_ticket = searchParams.get('pass_ticket')!;

      let wap_sid2 = null;
      const matchResult = item.set_cookie.match(/wap_sid2=(?<wap_sid2>.+?);/);
      if (matchResult && matchResult.groups && matchResult.groups.wap_sid2) {
        wap_sid2 = matchResult.groups.wap_sid2;
      }

      const { appmsg_token, cookie } = parseSetCookie(item.set_cookie);

      // 验证完整性
      if (!__biz || !uin || !key || !pass_ticket || !wap_sid2) {
        continue;
      }

      const info = await getInfoCache(__biz);
      _credentials.push({
        nickname: item.name || info?.nickname,
        avatar: item.avatar || info?.round_head_img,
        biz: __biz,
        uin: uin,
        key: key,
        pass_ticket: pass_ticket,
        wap_sid2: wap_sid2,
        appmsg_token: appmsg_token,
        cookie: cookie,
        timestamp: item.timestamp,
        time: dayjs(item.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        valid: Date.now() < item.timestamp + 1000 * 60 * CREDENTIAL_LIVE_MINUTES,
        added: Boolean(info),
      });
    }
    credentials.value = _credentials.sort((a, b) => b.timestamp - a.timestamp);
  });
  ws.addEventListener('close', () => {
    wsMonitoring.value = false;
    _ws = null;
    scheduleListenRetry();
  });
  ws.addEventListener('error', evt => {
    scheduleListenRetry();
  });
}

// 停止监听服务
async function stopListenService() {
  manulStopped = true;
  if (_ws) {
    _ws.close();
  }
  clearRetryTimer();
}

async function addAccount(credential: ParsedCredential) {
  if (credential.added || addingBiz.value === credential.biz) {
    return;
  }
  if (!checkLogin()) return;

  addingBiz.value = credential.biz;
  const nickname = credential.nickname || credential.biz;
  const account: MpAccount = {
    fakeid: credential.biz,
    completed: false,
    count: 0,
    articles: 0,
    total_count: 0,
    nickname: credential.nickname,
    round_head_img: credential.avatar,
  };

  try {
    await getArticleList(account, 0);
    credential.added = true;
    toast.success('公众号添加成功', `已成功添加公众号【${nickname}】`);
    // 通知其他视图（如公众号管理列表）立即刷新
    accountEventBus.emit('account-added', { fakeid: credential.biz });
  } catch (error: any) {
    if (error?.message === 'session expired') {
      modal.open(LoginModal);
    } else {
      toast.error('添加公众号失败', error?.message || '未知错误');
    }
  } finally {
    addingBiz.value = null;
  }
}

watchEffect(() => {
  if (!monitoring.value && !wsMonitoring.value) {
    state.value = 'inactive';
  } else if (monitoring.value || wsMonitoring.value) {
    state.value = 'active';
  } else {
    state.value = 'warning';
  }
});

watchEffect(() => {
  emit('update:pendingCount', pendingCredentialCount.value);
});

const copied = ref(false);
function copy(text: string) {
  navigator.clipboard.writeText(text);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1000);
}
</script>
