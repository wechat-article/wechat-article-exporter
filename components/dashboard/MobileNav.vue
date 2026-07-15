<script setup lang="ts">
interface NavItem {
  name: string;
  icon: string;
  href: string;
}

const items: NavItem[] = [
  { name: '公众号', icon: 'i-heroicons-users-20-solid', href: '/dashboard/account' },
  { name: '文章', icon: 'i-heroicons-document-arrow-down-20-solid', href: '/dashboard/article' },
  { name: '单篇', icon: 'i-heroicons-document-text-20-solid', href: '/dashboard/single' },
  { name: '合集', icon: 'i-heroicons-book-open-20-solid', href: '/dashboard/album' },
  { name: '代理', icon: 'i-heroicons-globe-alt-20-solid', href: '/dashboard/proxy' },
  { name: '设置', icon: 'i-heroicons-cog-6-tooth-20-solid', href: '/dashboard/settings' },
];
</script>

<template>
  <nav
    class="fixed inset-x-0 bottom-0 z-40 grid h-16 grid-cols-6 border-t border-cc-border bg-[#fdf8f6]/95 shadow-[0_-16px_36px_rgba(53,20,26,0.08)] backdrop-blur md:hidden"
  >
    <NuxtLink
      v-for="item in items"
      :key="item.name"
      :to="item.href"
      class="flex flex-col items-center justify-center gap-1 text-[11px] font-medium text-cc-muted transition hover:text-cc-text"
      active-class="text-cc-accent"
    >
      <UIcon :name="item.icon" class="size-4" />
      <span>{{ item.name }}</span>
    </NuxtLink>
  </nav>
</template>
