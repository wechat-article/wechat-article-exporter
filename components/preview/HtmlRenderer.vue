<template>
  <div>
    <client-only>
      <ShadowRoot>
        <div v-html="htmlContent"></div>
      </ShadowRoot>
    </client-only>
  </div>
</template>

<script lang="ts" setup>
import DOMPurify from 'dompurify';
import { ShadowRoot } from 'vue-shadow-dom';

interface Props {
  html: string;
}
const props = defineProps<Props>();

// 传入的完整HTML代码
const htmlContent = ref(DOMPurify.sanitize(props.html, { WHOLE_DOCUMENT: true }));

watch(
  () => props.html,
  (newHtml: string) => {
    // 使用DOMPurify来清理HTML内容，防止XSS攻击
    htmlContent.value = DOMPurify.sanitize(newHtml, { WHOLE_DOCUMENT: true });
  }
);
</script>
