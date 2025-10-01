<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">设置</h1>
    </Teleport>

    <div class="h-full overflow-scroll">
      <!--      <SettingCredential />-->
      <SettingProxy />
      <div class="flex flex-wrap">
        <SettingExport />
        <SettingMisc />
      </div>
      <div>
        <SettingDisplay />
      </div>
      <div class="h-[30vh]"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { websiteName } from '~/config';

useHead({
  title: `设置 | ${websiteName}`,
});
</script>
