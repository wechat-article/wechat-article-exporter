<script setup lang="ts">
interface Props {
  label?: string;
  color: 'green' | 'red' | 'rose' | 'blue';
}

const props = defineProps<Props>();

// Map color prop to Tailwind CSS classes
const colorClasses = {
  green: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    ring: 'ring-green-600/20',
  },
  red: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    ring: 'ring-red-600/20',
  },
  rose: {
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    ring: 'ring-rose-600/20',
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    ring: 'ring-blue-600/20',
  },
};

// Get the classes based on the color prop
const classes = colorClasses[props.color];
</script>

<template>
  <span
    :class="[classes.bg, classes.text, classes.ring]"
    class="inline-flex items-center rounded px-2 py-1 text-xs font-medium ring-1"
  >
    <slot name="default">{{ label }}</slot>
  </span>
</template>
