<script setup lang="ts">
import { isInsider } from '~/config/insider';

interface NavItem {
  name: string;
  icon: string;
  href: string;
  insider?: boolean;
  tags?: string[];
}

const items = ref<NavItem[]>([
  { name: '公众号管理', icon: 'i-lucide:users', href: '/dashboard/account' },
  { name: '文章下载', icon: 'i-lucide:file-down', href: '/dashboard/article' },
  { name: '合集下载', icon: 'i-lucide:library-big', href: '/dashboard/album' },
  { name: '公共代理', icon: 'i-lucide:globe', href: '/dashboard/proxy' },
  { name: 'API', icon: 'i-lucide:cable', href: '/dashboard/api', tags: ['内测'] },
  { name: '个人中心', icon: 'i-lucide:squirrel', href: '/dashboard/profile' },
  { name: '订阅源管理', icon: 'i-lucide:rss', href: '/dashboard/source' },
  { name: '渠道配置', icon: 'i-lucide:trending-up-down', href: '/dashboard/channel' },
  { name: '设置', icon: 'i-lucide:settings', href: '/dashboard/settings' },
  { name: '变更记录', icon: 'i-lucide:clock', href: '/dashboard/changelog' },
  // { name: '技术支持 & 赞助', icon: 'i-lucide:heart-handshake', href: '/dashboard/support' },
]);

const filteredItems = computed(() => {
  return items.value.filter(item => (isInsider.value ? true : !item.insider));
});
</script>

<template>
  <nav class="flex-1 mt-6">
    <ul class="flex flex-col gap-2">
      <li v-for="item in filteredItems" :key="item.name">
        <NuxtLink :to="item.href" class="flex h-8 items-center gap-2 rounded-md px-2 text-sm nav-link">
          <UIcon :name="item.icon" class="size-5 opacity-80" />
          <p>{{ item.name }}</p>
          <UBadge v-if="item.tags" v-for="tag in item.tags" color="fuchsia" variant="subtle">{{ tag }}</UBadge>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>

<style scoped>
.nav-link.router-link-active {
  @apply text-slate-12 dark:text-slate-200 bg-slate-3 dark:bg-slate-800 font-bold;
}
.nav-link:not(.router-link-active) {
  @apply text-slate-11 dark:text-slate-200 hover:bg-slate-4 dark:hover:bg-slate-800 hover:text-slate-12;
}
</style>
