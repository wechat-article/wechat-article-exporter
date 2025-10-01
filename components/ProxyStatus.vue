<template>
  <div class="flex flex-wrap xl:justify-between mb-5" v-for="(item, index) in data" :key="item.name">
    <div class="w-[250px] order-1">
      <span class="font-serif text-gray-400 font-bold">{{ index + 1 }}.</span>
      <UButton :to="'https://' + item.name" color="black" variant="link" target="_blank">{{ item.name }}</UButton>
    </div>
    <div class="order-3 xl:order-2 basis-full xl:basis-auto h-8 flex-1 flex justify-between gap-[5px] mr-10">
      <UTooltip
        v-for="tick in item.dailyRatios"
        :key="tick.date"
        :popper="{ placement: 'top', arrow: false }"
        :ui="{ base: 'h-fit p-3 bg-black', background: 'black' }"
        class="flex-1 rounded-[2px]"
        :class="
          tick.label === 'success'
            ? 'bg-green-400 hover:bg-green-500'
            : tick.label === 'warning'
              ? 'bg-yellow-400 hover:bg-yellow-500'
              : tick.label === 'failure'
                ? 'bg-red-400 hover:bg-red-500'
                : 'bg-gray-300 hover:bg-gray-400'
        "
      >
        <div class="h-full"></div>
        <template #text>
          <div class="flex flex-col items-center">
            <p class="font-medium text-sm text-gray-500">{{ tick.date }}</p>
            <p class="text-xl text-gray-300">{{ tick.ratio }}{{ tick.ratio !== '-' ? '%' : '' }}</p>
          </div>
        </template>
      </UTooltip>
    </div>
    <div
      class="order-2 xl:order-3 w-20 flex items-center gap-3"
      :class="item.currentStatus === 'up' ? 'text-green-400' : 'text-red-400'"
    >
      <span class="dot" :class="item.currentStatus"></span>
      <span class="capitalize">{{ item.currentStatus }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ResultProxyStatus } from '~/types/proxy';

interface Props {
  data: ResultProxyStatus[];
}

defineProps<Props>();
</script>

<style scoped>
.dot {
  width: 12px;
  height: 12px;
  display: inline-block;
  position: relative;
  transform: none;
  border-radius: 50%;
}
.dot.up {
  @apply bg-green-400;
}
.dot.down {
  @apply bg-red-400;
}
@keyframes pulse {
  0% {
    opacity: 0.5;
  }
  70% {
    opacity: 0;
    transform: scale(2.5);
  }
  100% {
    opacity: 0;
  }
}
.dot.up::after {
  content: '';
  width: 100%;
  height: 100%;
  position: absolute;
  opacity: 1;
  top: 0;
  left: 0;
  background: currentcolor;
  animation: 2s ease 0s infinite normal none running pulse;
  border-radius: 50%;
}
</style>
