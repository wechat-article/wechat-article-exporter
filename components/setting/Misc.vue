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
      <h3 class="text-xl font-semibold">其他</h3>
    </template>

    <div class="flex flex-col gap-6 xl:flex-row">
      <div class="flex-1 flex flex-col space-y-3">
        <div class="cc-option-row flex items-start gap-2">
          <UCheckbox v-model="preferences.hideDeleted" name="hideDeleted" label="隐藏已删除文章" />
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                是否在文章下载表格中显示已删除的文章。<br />
                若勾选该选项，则文章下载表格将过滤掉已经被删除的文章(无论文章内容是否已被下载)。
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </div>

        <div class="cc-option-row flex items-start gap-2">
          <UCheckbox
            v-model="preferences.downloadConfig.forceDownloadContent"
            name="forceDownloadContent"
            label="强制下载文章内容"
          />
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                在抓取文章内容时，若该文章内容已被下载，则会跳过抓取过程。<br />
                若勾选该选项，则会忽略已缓存内容，强制重新下载最新文章内容。<br />
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </div>

        <div class="cc-option-row flex items-start gap-2">
          <UCheckbox
            v-model="preferences.downloadConfig.metadataOverrideContent"
            name="metadataOverrideContent"
            label="抓取阅读量时是否覆盖文章内容"
          />
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[300px] p-3 text-sm text-gray-500">
                在抓取阅读量时，会同时下载文章内容。<br />
                若勾选该选项，则文章内容会同时保存到缓存中(会占用一定的存储空间)。
              </p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-5" />
          </UPopover>
        </div>
      </div>
      <div class="flex-1">
        <div class="cc-field">
          <p class="flex items-center gap-1">
            <label class="cc-field-label" for="account-sync-seconds">公众号同步频率</label>
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
          <p class="cc-field-help">控制抓取间隔；数值越小同步越快，也更容易触发限制。</p>
          <UInput
            id="account-sync-seconds"
            type="number"
            v-model="preferences.accountSyncSeconds"
            placeholder="例如 5"
            class="w-52 font-mono"
          >
            <template #trailing>
              <span class="text-gray-500 dark:text-gray-400 text-xs">秒</span>
            </template>
          </UInput>
        </div>
      </div>
    </div>
    <div class="cc-control-panel mt-5 p-4">
      <p class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between mb-3">
        <span class="text-[15px] font-semibold inline-flex items-center gap-1">
          同步时间范围
          <UPopover mode="hover" :popper="{ placement: 'top' }">
            <template #panel>
              <p class="max-w-[280px] p-2 text-xs text-gray-500">仅从当前时间向前回溯同步，不能选择未来日期。</p>
            </template>
            <UIcon color="gray" name="i-heroicons:question-mark-circle-16-solid" class="size-4 opacity-70" />
          </UPopover>
        </span>
        <span class="text-sm text-cc-accent font-medium">实际同步范围: {{ getActualDateRange() }}</span>
      </p>

      <div class="flex flex-col gap-3 sm:flex-row">
        <USelectMenu
          class="w-full sm:w-1/2"
          v-model="preferences.syncDateRange"
          :options="DURATION_OPTIONS"
          value-attribute="value"
          option-attribute="label"
        />
        <UPopover v-if="preferences.syncDateRange === 'point'" :popper="{ placement: 'bottom-start' }">
          <UButton color="gray" icon="i-heroicons-calendar-days-20-solid" :label="formatDate()" />

          <template #panel="{ close }">
            <BaseDatePicker v-model="preferences.syncDatePoint" is-required @close="close" />
          </template>
        </UPopover>
      </div>
    </div>
  </UCard>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { Preferences } from '~/types/preferences';

const { getActualDateRange, getSelectOptions } = useSyncDeadline();

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const DURATION_OPTIONS = getSelectOptions();

function formatDate() {
  return dayjs.unix(preferences.value.syncDatePoint).format('YYYY-MM-DD');
}
</script>
