<script setup lang="ts">
import BottomPanel from '~/components/dashboard/BottomPanel.vue';
import NavMenus from '~/components/dashboard/NavMenus.vue';
import { websiteName, websiteSubtitle } from '~/config';
</script>

<template>
  <aside class="cc-sidebar hidden md:flex flex-col h-screen w-[232px] flex-shrink-0 justify-between px-4 pb-5">
    <!-- 网站标题 & Logo -->
    <div class="flex items-center h-[60px]">
      <NuxtLink to="/" class="cc-brand flex min-w-0 items-center gap-3 font-semibold transition-colors">
        <span class="cc-brand-mark">W</span>
        <span class="min-w-0">
          <span class="block truncate text-[15px] font-semibold">{{ websiteName }}</span>
          <span class="cc-brand-kicker block">{{ websiteSubtitle }}</span>
        </span>
      </NuxtLink>
    </div>

    <!-- 导航菜单 -->
    <NavMenus />

    <!-- 底部视图 -->
    <BottomPanel />
  </aside>
</template>
