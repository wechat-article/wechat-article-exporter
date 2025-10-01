<template>
  <UCard class="mx-4 mt-10 flex-1">
    <template #header>
      <h3 class="text-2xl font-semibold">导出选项</h3>
      <p class="text-sm text-slate-10 font-serif">配置文章的导出选项</p>
    </template>

    <div class="flex flex-col space-y-5">
      <div>
        <p class="mb-2">
          <span class="mr-3">导出目录名:</span>
          <span class="inline-block w-8">
            <UPopover mode="hover" :popper="{ placement: 'right' }">
              <UButton color="white" size="sm" trailing-icon="i-heroicons:variable-16-solid" />

              <template #panel>
                <div class="p-4">
                  <p class="my-2 font-medium">支持的变量：</p>
                  <table class="w-full border-collapse border">
                    <tbody>
                      <tr>
                        <th class="w-20">变量</th>
                        <th class="w-32">含义</th>
                        <th class="w-20">变量</th>
                        <th class="w-32">含义</th>
                      </tr>
                      <tr>
                        <td class="text-center">title</td>
                        <td class="text-center">文章标题</td>
                        <td class="text-center">account</td>
                        <td class="text-center">公众号名称</td>
                      </tr>
                      <tr>
                        <td class="text-center">YYYY</td>
                        <td class="text-center">年</td>
                        <td class="text-center">MM</td>
                        <td class="text-center">月</td>
                      </tr>
                      <tr>
                        <td class="text-center">DD</td>
                        <td class="text-center">日</td>
                        <td class="text-center">HH</td>
                        <td class="text-center">时</td>
                      </tr>
                      <tr>
                        <td class="text-center">mm</td>
                        <td class="text-center">分</td>
                        <td class="text-center"></td>
                        <td class="text-center"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </template>
            </UPopover>
          </span>
        </p>
        <p class="text-sm mb-2 text-gray-500">影响 <span class="font-mono">html/txt/markdown/word/pdf</span> 的导出</p>
        <UInput
          placeholder="目录名格式"
          class="w-[600px] font-mono"
          name="dirname"
          v-model="preferences.exportConfig.dirname"
        />
      </div>
      <div>
        <UCheckbox
          v-model="preferences.exportConfig.exportExcelIncludeContent"
          name="exportExcelIncludeContent"
          label="导出 Excel 中包含文章内容"
        />
      </div>
      <div>
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
      </div>
      <div>
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
</script>

<style scoped>
table th {
  padding: 0.5rem 0.25rem;
}
table td {
  border: 1px solid #00002d17;
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
  border: 1px solid #00002d17;
  border-top: none;
}

tr:nth-child(even) {
  background-color: #00005506;
}

tr:hover {
  background-color: #00005506;
}
</style>
