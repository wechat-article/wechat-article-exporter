<script setup lang="ts">
const url = defineModel<string>({ required: true });

const emit = defineEmits<{
  add: [];
}>();

function onAdd() {
  emit('add');
}
</script>

<template>
  <div class="flex flex-1 gap-3">
    <UInput
      v-model="url"
      placeholder="请输入公众号文章链接"
      class="flex-1"
      aria-label="公众号文章链接"
      @keyup.enter="onAdd"
    />
    <UButton icon="i-heroicons-plus-20-solid" color="primary" @click="onAdd">添加</UButton>
  </div>
</template>
