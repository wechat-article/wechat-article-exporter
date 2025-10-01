<script setup lang="ts">
import BottomPanel from '~/components/dashboard/BottomPanel.vue';
import NavMenus from '~/components/dashboard/NavMenus.vue';
import { websiteName } from '~/config';
</script>

<template>
  <aside
    class="hidden md:flex flex-col h-screen w-[250px] flex-shrink-0 justify-between border-r border-slate-4 dark:border-slate-700 bg-slate-1 px-4 pb-6"
  >
    <!-- 网站标题 & Logo -->
    <div class="flex items-center h-[60px]">
      <NuxtLink to="/" class="px-2 font-bold text-xl">{{ websiteName }}</NuxtLink>
    </div>

    <!-- 导航菜单 -->
    <NavMenus />

    <!-- 底部视图 -->
    <BottomPanel />
  </aside>
</template>
