<template>
  <div class="h-screen">
    <UButton
      icon="i-lucide:x"
      square
      variant="link"
      color="gray"
      class="absolute right-3 top-3"
      @click="show = false"
    ></UButton>
    <client-only>
      <iframe class="border-none w-full h-screen" :srcdoc="htmlContent"></iframe>
    </client-only>
  </div>
</template>

<script lang="ts" setup>
import DOMPurify from 'dompurify';

interface Props {
  html: string;
}
const props = defineProps<Props>();
const show = defineModel<boolean>('show', { default: false });

// 传入的完整HTML代码
const htmlContent = ref('');

watch(
  () => props.html,
  (newHtml: string) => {
    // 使用DOMPurify来清理HTML内容，防止XSS攻击
    htmlContent.value = DOMPurify.sanitize(newHtml, { WHOLE_DOCUMENT: true });
  },
  { immediate: true }
);
</script>
