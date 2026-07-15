<script setup lang="ts">
interface NavItem {
  name: string;
  icon: string;
  href: string;
  insider?: boolean;
  tags?: string[];
}

const items = ref<NavItem[]>([
  { name: '公众号', icon: 'i-heroicons-users-20-solid', href: '/dashboard/account' },
  { name: '文章', icon: 'i-heroicons-document-arrow-down-20-solid', href: '/dashboard/article' },
  { name: '单篇', icon: 'i-heroicons-document-text-20-solid', href: '/dashboard/single' },
  { name: '合集', icon: 'i-heroicons-book-open-20-solid', href: '/dashboard/album' },
  { name: '代理', icon: 'i-heroicons-globe-alt-20-solid', href: '/dashboard/proxy' },
  { name: '设置', icon: 'i-heroicons-cog-6-tooth-20-solid', href: '/dashboard/settings' },
]);
</script>

<template>
  <nav class="flex-1 mt-5">
    <ul class="flex flex-col gap-1.5">
      <li v-for="item in items" :key="item.name">
        <NuxtLink :to="item.href" class="cc-nav-link flex items-center gap-2 px-3 text-sm nav-link">
          <UIcon :name="item.icon" class="size-4 opacity-85" />
          <p class="font-medium">{{ item.name }}</p>
          <UBadge v-if="item.tags" v-for="tag in item.tags" color="fuchsia" variant="subtle">{{ tag }}</UBadge>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
