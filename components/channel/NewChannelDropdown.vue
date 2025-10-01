<script setup lang="ts">
const emit = defineEmits(['new:webhook', 'new:email', 'new:dingdingBot']);

const items = [
  [
    {
      label: '邮箱',
      icon: 'i-lucide:mail',
      click: () => {
        emit('new:email');
      },
    },
    {
      label: '钉钉群机器人',
      icon: 'i-lucide:feather',
      click: () => {
        emit('new:dingdingBot');
      },
    },
    {
      label: 'webhook',
      icon: 'i-lucide:webhook',
      click: () => {
        emit('new:webhook');
      },
    },
  ],
];
</script>

<template>
  <UDropdown :items="items" :popper="{ placement: 'bottom-start' }">
    <UButton square color="blue" icon="i-lucide:plus" />
  </UDropdown>
</template>
