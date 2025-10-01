<script setup lang="ts">
defineProps({
  icon: {
    type: String,
    default: 'i-heroicons-solid:exclamation-triangle',
  },
  title: {
    type: String,
  },
  description: {
    type: String,
  },
});

const modal = useModal();
const emit = defineEmits(['confirm', 'cancel']);

function onConfirm() {
  emit('confirm');
  modal.close();
}
function onCancel() {
  emit('cancel');
  modal.close();
}
</script>

<template>
  <UModal prevent-close>
    <UCard>
      <div class="flex items-center gap-2 font-medium text-lg">
        <UIcon :name="icon" class="size-10 text-rose-500" />
        <span>{{ title }}</span>
      </div>
      <div v-if="description" class="my-5">{{ description }}</div>

      <template #footer>
        <div class="flex justify-end space-x-3">
          <UButton color="white" class="px-3" @click="onCancel">取消</UButton>
          <UButton color="rose" class="px-3" @click="onConfirm">确定</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
