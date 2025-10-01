<template>
  <form @submit.prevent="search">
    <UInput
      icon="i-heroicons-magnifying-glass-20-solid"
      color="white"
      required
      v-model="query"
      size="md"
      :trailing="false"
      placeholder="搜索公众号名称"
    />
  </form>
</template>

<script setup lang="ts">
const query = defineModel<string>();
const emit = defineEmits(['search']);

function search() {
  emit('search', query.value);
}
</script>
