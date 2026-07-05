<template>
  <div class="cc-dashboard-layout flex min-h-screen bg-cc-app">
    <!-- 左侧边栏 -->
    <SideBar />

    <div class="cc-dashboard-main flex flex-col flex-1 overflow-hidden h-screen bg-cc-app">
      <!-- 顶部操作栏 -->
      <div class="cc-topbar flex flex-shrink-0 items-center justify-between px-5">
        <div id="title"></div>
        <GlobalActions />
      </div>

      <!-- 页面容器 -->
      <div class="flex-1 overflow-hidden pb-16 md:pb-0">
        <NuxtPage />
      </div>
    </div>
    <MobileNav />
  </div>
</template>

<script setup lang="ts">
import GlobalActions from '~/components/dashboard/Actions.vue';
import MobileNav from '~/components/dashboard/MobileNav.vue';
import SideBar from '~/components/dashboard/SideBar.vue';
</script>
