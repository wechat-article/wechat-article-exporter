<template>
  <div class="flex items-baseline">
    <div class="space-x-2 flex text-sm">
      <label v-for="option in options" :key="option.label" @click="value = option.value">
        <input class="sr-only peer" :name="name" type="radio" :value="option.value" :checked="value === option.value" />
        <span
          class="px-3 py-2 rounded-lg flex items-center justify-center text-slate-700 peer-checked:font-semibold peer-checked:bg-slate-900 peer-checked:text-white"
        >
          {{ option.label }}
        </span>
      </label>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  name: string;
  options: Array<{ label: string; value: string }>;
}
defineProps<Props>();

const value = defineModel<string>();
</script>
