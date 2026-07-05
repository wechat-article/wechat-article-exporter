<template>
  <UDropdown :items="items" :popper="{ placement: 'bottom-start' }">
    <slot>
      <UButton color="white" label="导出" trailing-icon="i-heroicons-chevron-down-20-solid" />
    </slot>
  </UDropdown>
</template>

<script setup lang="ts">
const emit = defineEmits();

interface Item {
  label: string;
  event: string;
  disabled?: boolean;
  /** 悬停提示（原生 title，用于缩短菜单文案时补充说明） */
  detail?: string;
}
interface Props {
  items: Item[];
}

const props = defineProps<Props>();

const items = computed(() => [
  props.items.map(item => ({
    label: item.label,
    ...(item.detail ? { title: item.detail } : {}),
    click() {
      emit(item.event);
    },
    disabled: item.disabled,
  })),
]);
</script>
