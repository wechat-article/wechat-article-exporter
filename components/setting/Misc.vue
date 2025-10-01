<template>
  <UCard class="mx-4 mt-10 flex-1">
    <template #header>
      <h3 class="text-2xl font-semibold">其他</h3>
    </template>

    <div class="flex">
      <div class="flex-1 flex flex-col space-y-5">
        <div class="flex gap-1">
          <UCheckbox v-model="preferences.hideDeleted" name="hideDeleted" label="隐藏已删除文章" />
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                是否在文章下载页面显示已删除的文章。<br />
                若启用该选项，则表格将过滤掉已经被删除的文章(无论文章内容是否已被下载)。
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </div>

        <div class="flex gap-1">
          <UCheckbox
            v-model="preferences.downloadConfig.forceDownloadContent"
            name="forceDownloadContent"
            label="强制下载文章内容"
          />
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                在抓取文章内容时，若该文章内容已被下载，则会跳过抓取过程。<br />
                若启用该选项，则会忽略已缓存内容，强制重新下载最新文章内容。
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </div>
      </div>
      <div class="flex-1">
        <div>
          <p class="flex">
            <span class="text-sm">公众号同步频率：</span>
            <UPopover mode="hover" :popper="{ placement: 'top' }">
              <template #panel>
                <p class="max-w-[300px] p-3 text-sm text-gray-500">
                  在同步公众号文章数据时，程序会自动抓取该公众号的所有文章，直到所有数据同步完成。<br />
                  该选项用于控制抓取频率，比如设置为 5
                  就表示每五秒抓取一次。该数据越小，同步的越快，但是容易被封号。推荐不小于3
                </p>
              </template>
              <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
            </UPopover>
          </p>
          <UInput
            type="number"
            v-model="preferences.accountSyncSeconds"
            placeholder="配置公众号同步频率"
            class="w-52 font-mono"
          >
            <template #trailing>
              <span class="text-gray-500 dark:text-gray-400 text-xs">秒/次</span>
            </template>
          </UInput>
        </div>
      </div>
    </div>
    <div class="border border-slate-200 p-3 rounded-md mt-5">
      <p class="mb-3">同步时间范围：</p>
      <RadioGroup name="duration" :options="DURATION_OPTIONS" v-model="preferences.syncDateRange" />
    </div>
  </UCard>
</template>

<script setup lang="ts">
import type { Preferences } from '~/types/preferences';

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const DURATION_OPTIONS = [
  {
    value: '1d',
    label: '最近一天',
  },
  {
    value: '7d',
    label: '最近七天',
  },
  {
    value: '1m',
    label: '最近一个月',
  },
  {
    value: '3m',
    label: '最近三个月',
  },
  {
    value: '6m',
    label: '最近半年',
  },
  {
    value: '1y',
    label: '最近一年',
  },
  {
    value: 'all',
    label: '全部',
  },
];
</script>
