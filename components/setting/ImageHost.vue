<template>
  <UCard class="mx-4 mt-10">
    <template #header>
      <h3 class="text-2xl font-semibold">图床设置（七牛云+PicGo）</h3>
      <p class="text-sm text-slate-10 font-serif">配置图片上传到图床服务</p>
    </template>

    <div class="flex flex-col space-y-5">
      <div class="flex gap-1">
        <UCheckbox
          v-model="preferences.imageHost.enabled"
          name="imageHostEnabled"
          label="启用图床上传"
        />
        <UPopover mode="hover" :popper="{ placement: 'top' }">
          <template #panel>
            <p class="max-w-[300px] p-3 text-sm text-gray-500">
              启用后，导出文章时会自动将微信图片上传到图床服务，并替换为图床链接。<br />
              若图床服务不可用，将保留原始微信图片链接。
            </p>
          </template>
          <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
        </UPopover>
      </div>

      <div :class="{ 'opacity-50 pointer-events-none': !preferences.imageHost.enabled }">
        <p class="flex mb-2">
          <span class="text-sm">图床 API 地址：</span>
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                图床服务的上传接口地址。<br />
                接口规范：POST 请求，请求体 { "list": ["url1", "url2", ...] }，响应 { "success": true, "result": ["newUrl1", "newUrl2", ...] }
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </p>
        <UInput
          v-model="preferences.imageHost.apiUrl"
          placeholder="http://127.0.0.1:36677/upload"
          class="w-full max-w-[500px] font-mono"
        />
      </div>

      <div :class="{ 'opacity-50 pointer-events-none': !preferences.imageHost.enabled }">
        <p class="flex mb-2">
          <span class="text-sm">批量上传数量：</span>
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                每次批量上传的图片数量。<br />
                该数值越大，上传速度越快，但可能导致图床服务压力过大。推荐值：10-30
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </p>
        <UInput
          type="number"
          v-model="preferences.imageHost.batchSize"
          placeholder="20"
          class="w-32 font-mono"
          :min="1"
          :max="100"
        >
          <template #trailing>
            <span class="text-gray-500 dark:text-gray-400 text-xs">张/批</span>
          </template>
        </UInput>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Preferences } from '~/types/preferences';

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;
</script>
