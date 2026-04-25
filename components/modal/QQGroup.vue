<script setup lang="ts">
import qqGroupImg from '~/assets/qq-group-2.png';

const modal = useModal();

function onClose() {
  modal.close();
}
</script>

<template>
  <UModal prevent-close>
    <UCard>
      <template #header>
        <h2 class="text-lg font-semibold">加入 QQ 群</h2>
        <UButton square variant="link" color="gray" class="absolute right-3 top-3" @click="onClose">
          <UIcon name="i-lucide:x" class="size-6" />
        </UButton>
      </template>

      <!-- 二维码图片展示区 -->
      <div class="flex flex-col justify-center items-center mx-auto">
        <img :src="qqGroupImg" alt="" class="size-72" />
        <p class="text-2xl">群号: <span class="font-mono">775909845</span></p>
      </div>
    </UCard>
  </UModal>
</template>
