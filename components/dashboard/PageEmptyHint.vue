<script setup lang="ts">
defineProps<{
  title: string;
  description?: string;
}>();
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-2 text-center max-w-md">
    <UIcon name="i-heroicons-inbox-20-solid" class="size-12 text-cc-muted" aria-hidden="true" />
    <p class="text-base font-medium text-cc-text">{{ title }}</p>
    <p v-if="description" class="text-sm text-cc-muted">{{ description }}</p>
  </div>
</template>
