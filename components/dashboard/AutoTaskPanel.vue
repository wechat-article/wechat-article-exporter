<script setup lang="ts">
import { useAutoTask } from '~/composables/useAutoTask';

const {
  isRunning,
  isPaused,
  currentPhase,
  currentAccount,
  syncProgress,
  downloadProgress,
  exportProgress,
  logs,
  exportDirectoryPath,
  selectExportDirectory,
  start,
  stop,
  pause,
  resume,
  clearLogs,
  needsResume,
  markAsPaused,
} = useAutoTask();

// 阶段名称映射
const phaseNames = {
  idle: '空闲',
  sync: '同步中',
  download: '下载中',
  export: '导出中',
};

// 阶段图标
const phaseIcons = {
  idle: 'i-lucide:circle-pause',
  sync: 'i-lucide:refresh-cw',
  download: 'i-lucide:download',
  export: 'i-lucide:file-text',
};

// 计算进度百分比
function progressPercent(progress: { current: number; total: number }): number {
  if (progress.total === 0) return 0;
  return Math.round((progress.current / progress.total) * 100);
}

// 日志级别样式
const logLevelClass = {
  info: 'text-gray-500',
  warn: 'text-amber-500',
  error: 'text-red-500',
  success: 'text-green-500',
};

// 格式化时间
function formatTime(date: Date): string {
  return date.toLocaleTimeString('zh-CN', { hour12: false });
}

// 展开/收起日志
const showLogs = ref(false);

// 页面离开警告
function handleBeforeUnload(e: BeforeUnloadEvent) {
  if (isRunning.value && !isPaused.value) {
    // 标记为暂停状态以便恢复
    markAsPaused();
    e.preventDefault();
    e.returnValue = '自动任务正在运行，刷新页面将导致任务中断。确定离开吗？';
    return e.returnValue;
  }
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
});

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

// 恢复任务：先选择目录再恢复
async function handleResume() {
  if (!exportDirectoryPath.value) {
    const selected = await selectExportDirectory();
    if (!selected) return;
  }
  resume();
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
    <!-- 头部：状态和控制 -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-3">
        <div class="flex items-center gap-2">
          <UIcon 
            :name="phaseIcons[currentPhase]" 
            :class="[
              'w-5 h-5',
              isRunning ? 'text-blue-500 animate-spin' : 'text-gray-400'
            ]" 
          />
          <span class="font-medium">自动任务</span>
        </div>
        
        <UBadge 
          :color="isRunning ? (isPaused ? 'amber' : 'blue') : 'gray'"
          :label="isRunning ? (isPaused ? '已暂停' : phaseNames[currentPhase]) : '未运行'"
        />
        
        <span v-if="currentAccount && isRunning" class="text-sm text-gray-500">
          - {{ currentAccount.nickname }}
        </span>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- 目录选择 -->
        <UButton
          v-if="!isRunning || isPaused"
          size="sm"
          color="gray"
          variant="ghost"
          icon="i-lucide:folder-open"
          @click="selectExportDirectory"
        >
          {{ exportDirectoryPath || '选择目录' }}
        </UButton>
        
        <!-- 启动/停止按钮 -->
        <UButton
          v-if="!isRunning"
          color="blue"
          icon="i-lucide:play"
          @click="start"
        >
          启动自动任务
        </UButton>
        
        <template v-else>
          <UButton
            v-if="!isPaused"
            color="amber"
            variant="soft"
            icon="i-lucide:pause"
            @click="pause"
          >
            暂停
          </UButton>
          <UButton
            v-else
            color="blue"
            variant="soft"
            icon="i-lucide:play"
            @click="handleResume"
          >
            恢复
          </UButton>
          <UButton
            color="red"
            variant="soft"
            icon="i-lucide:square"
            @click="stop"
          >
            停止
          </UButton>
        </template>
      </div>
    </div>
    
    <!-- 恢复任务提示 -->
    <div v-if="needsResume && isPaused" class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
      <div class="flex items-center gap-2 text-amber-700 dark:text-amber-300">
        <UIcon name="i-lucide:alert-triangle" class="w-5 h-5 shrink-0" />
        <span class="text-sm">
          检测到未完成的任务。请重新选择导出目录，然后点击"恢复"继续执行。
        </span>
      </div>
    </div>

    <!-- 进度区域 -->
    <div v-if="isRunning" class="space-y-3 mb-4">
      <!-- 同步进度 -->
      <div class="flex items-center gap-3">
        <span class="w-16 text-sm text-gray-500">同步</span>
        <div class="flex-1">
          <UProgress 
            :value="progressPercent(syncProgress)" 
            :color="currentPhase === 'sync' ? 'blue' : 'primary'"
          />
        </div>
        <span class="w-20 text-right text-sm text-gray-500">
          {{ syncProgress.current }}/{{ syncProgress.total }}
        </span>
      </div>
      
      <!-- 下载进度 -->
      <div class="flex items-center gap-3">
        <span class="w-16 text-sm text-gray-500">下载</span>
        <div class="flex-1">
          <UProgress 
            :value="progressPercent(downloadProgress)" 
            :color="currentPhase === 'download' ? 'blue' : 'primary'"
          />
        </div>
        <span class="w-20 text-right text-sm text-gray-500">
          {{ downloadProgress.current }}/{{ downloadProgress.total }}
        </span>
      </div>
      
      <!-- 导出进度 -->
      <div class="flex items-center gap-3">
        <span class="w-16 text-sm text-gray-500">导出</span>
        <div class="flex-1">
          <UProgress 
            :value="progressPercent(exportProgress)" 
            :color="currentPhase === 'export' ? 'blue' : 'primary'"
          />
        </div>
        <span class="w-20 text-right text-sm text-gray-500">
          {{ exportProgress.current }}/{{ exportProgress.total }}
        </span>
      </div>
    </div>
    
    <!-- 日志区域 -->
    <div class="border-t border-gray-200 dark:border-gray-700 pt-3">
      <div 
        class="flex items-center justify-between cursor-pointer"
        @click="showLogs = !showLogs"
      >
        <span class="text-sm text-gray-500 flex items-center gap-1">
          <UIcon :name="showLogs ? 'i-lucide:chevron-down' : 'i-lucide:chevron-right'" class="w-4 h-4" />
          日志 ({{ logs.length }})
        </span>
        <UButton
          v-if="logs.length > 0"
          size="xs"
          color="gray"
          variant="ghost"
          @click.stop="clearLogs"
        >
          清空
        </UButton>
      </div>
      
      <div 
        v-if="showLogs" 
        class="mt-2 max-h-40 overflow-y-auto bg-gray-50 dark:bg-gray-900 rounded p-2 font-mono text-xs"
      >
        <div 
          v-for="(log, index) in logs" 
          :key="index"
          class="flex gap-2"
        >
          <span class="text-gray-400 shrink-0">{{ formatTime(log.time) }}</span>
          <span :class="logLevelClass[log.level]">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="text-gray-400 text-center py-2">
          暂无日志
        </div>
      </div>
    </div>
  </div>
</template>
