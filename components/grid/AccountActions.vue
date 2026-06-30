<script setup lang="ts">
import type { ICellRendererParams } from 'ag-grid-community';
import { Loader } from 'lucide-vue-next';
import { request } from '#shared/utils/request';
import { db } from '~/store/v2/db';

interface Props {
  params: ICellRendererParams & {
    onSync?: (params: ICellRendererParams) => void;
    onStop?: (params: ICellRendererParams) => void;
    isDeleting: boolean;
    isSyncing: boolean;
    syncingRowId: string | null;
  };
}
const props = defineProps<Props>();

const fakeid = computed(() => props.params.data.fakeid);
const nickname = computed(() => props.params.data.nickname || '未命名');

// 服务器端任务状态
const serverSyncStatus = ref({ status: 'idle', progress: 0, total: 0, error: '' });
const serverDownloadStatus = ref({ status: 'idle', progress: 0, total: 0, error: '' });

let pollTimer: number | null = null;

async function checkServerStatus() {
  try {
    const res = await request<{
      sync: { status: string; progress: number; total: number; error?: string };
      download: { status: string; progress: number; total: number; error?: string };
    }>(`/api/web/task/status?fakeid=${fakeid.value}`);
    
    if (res) {
      serverSyncStatus.value = res.sync;
      serverDownloadStatus.value = res.download;
      
      // 如果服务器已经同步完成，但是本地浏览器数据库的群发数不匹配或未完成，则自动下载导入
      if (res.sync.status === 'completed') {
        const localInfo = await db.info.get(fakeid.value);
        // articles.json 包含的文章总数对应的群发次数
        const serverTotalMsg = res.sync.total;
        
        if (!localInfo || localInfo.count !== serverTotalMsg || !localInfo.completed) {
          try {
            const articles = await request<any[]>(`/api/web/task/articles?nickname=${encodeURIComponent(nickname.value)}`);
            if (articles && Array.isArray(articles)) {
              await importArticlesToLocal(articles);
            }
          } catch (err) {
            console.error('自动导入同步数据失败:', err);
          }
        }
      }
      
      // 如果有任何任务在运行，启动/继续轮询
      if (res.sync.status === 'running' || res.download.status === 'running') {
        startPolling();
      } else {
        stopPolling();
      }
    }
  } catch (e) {
    console.error('Failed to get server task status', e);
  }
}

async function importArticlesToLocal(articles: any[]) {
  await db.transaction('rw', ['article', 'info'], async () => {
    const keys = await db.article.toCollection().keys();
    let msgCount = 0;
    let articleCount = 0;

    for (const article of articles) {
      const key = `${fakeid.value}:${article.aid}`;
      await db.article.put({ ...article, fakeid: fakeid.value, _status: '' }, key);
      if (!keys.includes(key)) {
        articleCount++;
      }
      if (article.itemidx === 1) {
        msgCount++;
      }
    }

    let infoCache = await db.info.get(fakeid.value);
    if (!infoCache) {
      infoCache = {
        fakeid: fakeid.value,
        completed: true,
        count: msgCount,
        articles: articleCount,
        nickname: nickname.value,
        total_count: articles.filter(a => a.itemidx === 1).length,
        create_time: Math.round(Date.now() / 1000),
        update_time: Math.round(Date.now() / 1000),
      };
    } else {
      infoCache.completed = true;
      infoCache.count = msgCount;
      infoCache.articles = articleCount;
      infoCache.total_count = articles.filter(a => a.itemidx === 1).length;
      infoCache.update_time = Math.round(Date.now() / 1000);
    }
    
    await db.info.put(infoCache);
    
    // 更新当前行的 AgGrid 数据以更新 UI 上的已同步消息数和总消息数
    props.params.node.setData(infoCache);
  });
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = window.setInterval(checkServerStatus, 1500);
}

function stopPolling() {
  if (pollTimer) {
    window.clearInterval(pollTimer);
    pollTimer = null;
  }
}

onMounted(() => {
  checkServerStatus();
});

onUnmounted(() => {
  stopPolling();
});

async function triggerServerSync() {
  try {
    serverSyncStatus.value.status = 'running';
    await request('/api/web/task/sync', {
      method: 'POST',
      body: {
        fakeid: fakeid.value,
        nickname: nickname.value,
      }
    });
    checkServerStatus();
  } catch (e: any) {
    alert('触发服务器同步失败: ' + e.message);
  }
}

async function triggerServerDownload() {
  try {
    serverDownloadStatus.value.status = 'running';
    
    // 从 localStorage 读取代理设置
    let proxyUrl = '';
    try {
      const prefs = JSON.parse(localStorage.getItem('preferences') || '{}');
      if (prefs.privateProxyList && prefs.privateProxyList.length > 0) {
        proxyUrl = prefs.privateProxyList[0];
      }
    } catch (err) {}

    await request('/api/web/task/download', {
      method: 'POST',
      body: {
        fakeid: fakeid.value,
        nickname: nickname.value,
        proxyUrl: proxyUrl,
      }
    });
    checkServerStatus();
  } catch (e: any) {
    alert('触发服务器下载失败: ' + e.message);
  }
}

// 浏览器本地同步方法
function sync() {
  props.params.onSync && props.params.onSync(props.params);
}
function stop() {
  props.params.onStop && props.params.onStop(props.params);
}
const isDisabled = computed(() => props.params.isDeleting || props.params.isSyncing);
const isLoading = computed(() => props.params.isSyncing && props.params.node.id === props.params.syncingRowId);
</script>

<template>
  <div class="flex items-center justify-center gap-3">
    <!-- 本地同步 -->
    <UButton v-if="isLoading" color="green" size="xs" variant="solid" @click="stop" title="停止本地同步">
      <Loader :size="14" class="animate-spin" />
      停止
    </UButton>
    <UButton
      v-else
      icon="i-heroicons:arrow-path-rounded-square-20-solid"
      color="blue"
      size="xs"
      :disabled="isDisabled"
      @click="sync"
      title="本地同步 (下载至浏览器缓存)"
    ></UButton>

    <!-- 服务器云同步 -->
    <UButton
      v-if="serverSyncStatus.status === 'running'"
      color="orange"
      size="xs"
      variant="solid"
      disabled
    >
      <Loader :size="14" class="animate-spin" />
      云同步 {{ serverSyncStatus.progress }}/{{ serverSyncStatus.total || '...' }}
    </UButton>
    <UButton
      v-else-if="serverSyncStatus.status === 'completed'"
      icon="i-heroicons:cloud-arrow-down-20-solid"
      color="green"
      size="xs"
      @click="triggerServerSync"
      title="服务器同步完成，点击重新同步"
    >
      已云同步
    </UButton>
    <UButton
      v-else
      icon="i-heroicons:cloud-20-solid"
      color="purple"
      size="xs"
      :disabled="isDisabled"
      @click="triggerServerSync"
      title="同步公众号至服务器"
    >
      云同步
    </UButton>

    <!-- 服务器云下载 -->
    <UButton
      v-if="serverDownloadStatus.status === 'running'"
      color="amber"
      size="xs"
      variant="solid"
      disabled
    >
      <Loader :size="14" class="animate-spin" />
      云下载 {{ serverDownloadStatus.progress }}/{{ serverDownloadStatus.total }}
    </UButton>
    <UButton
      v-slot:default
      v-else-if="serverDownloadStatus.status === 'completed'"
      icon="i-heroicons:check-circle-20-solid"
      color="emerald"
      size="xs"
      @click="triggerServerDownload"
      title="文件已存至服务器，点击重新下载"
    >
      已云下载
    </UButton>
    <UButton
      v-else
      icon="i-heroicons:arrow-down-tray-20-solid"
      color="teal"
      size="xs"
      :disabled="isDisabled || serverSyncStatus.status !== 'completed'"
      @click="triggerServerDownload"
      title="下载文章及图片至服务器本地目录"
    >
      云下载
    </UButton>
  </div>
</template>
