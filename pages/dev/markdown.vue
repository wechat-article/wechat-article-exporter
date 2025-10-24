<template>
  <div class="p-2 mx-auto container h-screen">
    <div class="rounded-lg border shadow-sm">
      <div class="flex flex-col space-y-1.5 p-6">
        <h2 class="text-2xl font-semibold leading-none tracking-tight">HTML 转换为 Markdown</h2>
        <p class="text-sm text-stone-500">将 HTML 代码转换为 Markdown 格式的试验场</p>
      </div>
      <div class="p-6 pt-0">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
            <div class="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h3 class="font-medium text-gray-800 dark:text-gray-200">HTML 输入</h3>
            </div>
            <div class="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
              <div class="flex gap-3 my-2">
                <UInput
                  placeholder="请输入缓存文章的URL"
                  class="flex-1"
                  v-model="url"
                  icon="i-lucide:link"
                  color="gray"
                />
                <UButton :loading="loading" :disabled="btnDisabled" @click="loadCacheHtml" color="gray">加载</UButton>
              </div>
            </div>
            <div>
              <MonacoEditor v-model="htmlCode" lang="html" class="h-[600px] py-3" :options="editorOptions" />
            </div>
          </div>
          <div class="border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden">
            <div class="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
              <h3 class="font-medium text-gray-800 dark:text-gray-200">Markdown 输出</h3>
            </div>
            <div>
              <MonacoEditor
                v-model="mdCode"
                lang="markdown"
                class="h-[600px] py-3"
                :options="{ ...editorOptions, readOnly: true }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import TurndownService from 'turndown';
import { Exporter } from '~/utils/download/Exporter';

const htmlCode = ref('<h1>Hello World</h1><p>This is a <strong>bold</strong> paragraph.</p>');
const mdCode = ref('');

// 初始化 Turndown 服务
const turndownService = new TurndownService({
  headingStyle: 'atx', // 标题样式：atx (# Heading) 或 setext (H1\n===)
  bulletListMarker: '-', // 无序列表标记
  codeBlockStyle: 'fenced', // 代码块样式：fenced (```) 或 indented
});

// 监听 HTML 变化，实时转换为 Markdown
watch(
  htmlCode,
  newVal => {
    if (newVal) {
      mdCode.value = turndownService.turndown(newVal);
    }
  },
  { immediate: true }
);

// 编辑器通用选项
const editorOptions: any = {
  minimap: { enabled: false },
  fontSize: 16,
  theme: 'vs-light',
  wordWrap: 'on',
};

const url = ref('');
const btnDisabled = computed(() => !/^https?:\/\//i.test(url.value));
const loading = ref(false);
async function loadCacheHtml() {
  loading.value = true;
  try {
    htmlCode.value = await Exporter.getPureContent(url.value, 'html');
  } finally {
    loading.value = false;
  }
}
</script>
