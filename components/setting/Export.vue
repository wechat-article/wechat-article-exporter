<template>
  <UCard
    class="cc-settings-card flex-1"
    :ui="{
      ring: '',
      divide: 'divide-y divide-cc-border',
      header: { padding: 'px-5 py-4 sm:px-6' },
      body: { padding: 'px-5 py-5 sm:px-6' },
    }"
  >
    <template #header>
      <h3 class="text-xl font-semibold">导出选项</h3>
    </template>

    <div class="flex flex-col space-y-5">
      <div class="cc-field">
        <div class="flex items-center gap-2">
          <label class="cc-field-label" for="export-dirname">导出目录名</label>
          <span class="inline-flex">
            <UPopover mode="hover" :popper="{ placement: 'right' }">
              <UButton color="primary" variant="ghost" size="xs" trailing-icon="i-heroicons:variable-16-solid" />

              <template #panel>
                <div class="p-4 text-cc-text">
                  <p class="my-2 text-sm text-cc-muted">
                    使用 <code class="px-1 py-0.5 bg-rose-50 font-mono text-xs text-cc-accent">${变量名}</code> 的格式插入变量，例如：<code class="px-1 py-0.5 bg-rose-50 font-mono text-xs text-cc-accent">${YYYY}-${MM}-${DD}_${title}</code>
                  </p>
                  <p class="my-2 font-medium">支持的变量</p>
                  <table class="w-full border-collapse border border-cc-border">
                    <tbody>
                      <tr>
                        <th class="w-20">变量</th>
                        <th class="w-32">含义</th>
                        <th class="w-20">变量</th>
                        <th class="w-32">含义</th>
                      </tr>
                      <tr v-for="(item, idx) in variables" :key="idx">
                        <td class="text-center">{{ item[0].name }}</td>
                        <td class="text-center">{{ item[0].description }}</td>
                        <td class="text-center">{{ item[1].name }}</td>
                        <td class="text-center">{{ item[1].description }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </UPopover>
          </span>
        </div>
        <p class="cc-field-help">影响 <span class="font-mono">html/txt/markdown/word</span> 的导出目录结构。</p>
        <UInput
          id="export-dirname"
          placeholder="目录名格式"
          class="w-full max-w-[600px] font-mono"
          name="dirname"
          v-model="preferences.exportConfig.dirname"
        />
        <p class="cc-form-preview mt-1 px-3 py-2 text-sm">
          <span class="mr-1">预览:</span>
          <span class="font-mono text-cc-text">{{ dirnamePreview }}</span>
        </p>
      </div>
      <div class="cc-field max-w-xs">
        <label class="cc-field-label" for="export-dirname-maxlength">目录名最大长度</label>
        <p class="cc-field-help">0 表示不限制。</p>
        <UInput
          id="export-dirname-maxlength"
          placeholder="目录名最大长度"
          v-model="preferences.exportConfig.maxlength"
          type="number"
          min="0"
        />
      </div>
      <p class="cc-field-label">内容包含规则</p>
      <div class="cc-option-row">
        <UCheckbox
          v-model="preferences.exportConfig.exportExcelIncludeContent"
          name="exportExcelIncludeContent"
          label="导出 Excel 中包含文章内容"
        />
      </div>
      <div class="cc-option-row space-y-3">
        <UCheckbox
          v-model="preferences.exportConfig.exportJsonIncludeContent"
          name="exportJsonIncludeContent"
          label="导出 JSON 中包含文章内容"
        />
        <UCheckbox
          v-model="preferences.exportConfig.exportJsonIncludeComments"
          name="exportJsonIncludeComments"
          label="导出 JSON 中包含留言数据"
        />
        <UCheckbox
          v-model="preferences.exportConfig.exportJsonIncludeSummaryEnrichment"
          name="exportJsonIncludeSummaryEnrichment"
          label="导出 JSON 中包含已人工允许的摘要审计"
        />
      </div>
      <div class="cc-option-row">
        <UCheckbox
          v-model="preferences.exportConfig.exportHtmlIncludeComments"
          name="exportHtmlIncludeComments"
          label="导出 HTML 中包含留言数据"
        />
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Preferences } from '~/types/preferences';

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const sampleData: Record<string, string> = {
  account: '人民日报',
  title: '这是一篇示例文章标题',
  aid: '100000001',
  author: '张三',
  YYYY: '2025',
  MM: '03',
  DD: '15',
  HH: '10',
  mm: '30',
};

const dirnamePreview = computed(() => {
  let result = preferences.value.exportConfig.dirname || '';
  for (const [key, value] of Object.entries(sampleData)) {
    result = result.replace(new RegExp(`\\$\\{${key}}`, 'g'), value);
  }
  const maxlength = preferences.value.exportConfig.maxlength;
  if (maxlength) {
    result = result.slice(0, maxlength);
  }
  return result || '（空）';
});

const _variables = [
  { name: 'account', description: '公众号名称' },
  { name: 'title', description: '文章标题' },
  { name: 'aid', description: '文章id' },
  { name: 'author', description: '作者' },
  { name: 'YYYY', description: '年' },
  { name: 'MM', description: '月' },
  { name: 'DD', description: '日' },
  { name: 'HH', description: '时' },
  { name: 'mm', description: '分' },
];
const variables = Array.from({ length: Math.ceil(_variables.length / 2) }, (_, i) => [
  _variables[i * 2] ?? {},
  _variables[i * 2 + 1] ?? {},
]);
</script>

<style scoped>
table th {
  padding: 0.5rem 0.25rem;
}
table td {
  border: 1px solid rgba(53, 20, 26, 0.12);
  padding: 0.25rem 0.5rem;
}

td:first-child,
th:first-child {
  border-left: none;
}

td:last-child,
th:last-child {
  border-right: none;
}

th {
  border: 1px solid rgba(53, 20, 26, 0.12);
  border-top: none;
}

tr:nth-child(even) {
  background-color: rgba(215, 92, 112, 0.05);
}

tr:hover {
  background-color: rgba(215, 92, 112, 0.08);
}
</style>
