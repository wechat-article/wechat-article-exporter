<template>
  <form @submit.prevent="search">
    <UInput
      icon="i-heroicons-magnifying-glass-20-solid"
      color="white"
      v-model="query"
      size="md"
      class="focus-within:w-[300px] w-[200px] transition-all duration-300 ease-in-out"
      :trailing="false"
      :placeholder="'搜索文章标题 (' + metaSymbol + '+K)'"
      ref="inputRef"
    />
  </form>
</template>

<script setup lang="ts">
const query = defineModel<string>();
const emit = defineEmits(['search']);
const { metaSymbol } = useShortcuts();
function search() {
  emit('search', query.value);
}

const inputRef = ref();
defineShortcuts({
  meta_k: {
    usingInput: true,
    handler: () => {
      inputRef.value.input.focus();
    },
  },
  escape: {
    usingInput: true,
    handler: () => {
      inputRef.value.input.blur();
    },
  },
});
</script>
