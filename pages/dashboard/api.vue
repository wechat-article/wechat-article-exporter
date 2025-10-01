<template>
  <div class="flex flex-col h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">API</h1>
    </Teleport>
    <div class="flex-1 p-6 overflow-scroll space-y-20">
      <ApiSummary />
      <ApiDocument v-for="(api, idx) in apis" :key="idx" v-bind="api" :index="idx + 1" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { apis, websiteName } from '~/config';

useHead({
  title: `API | ${websiteName}`,
});
</script>
