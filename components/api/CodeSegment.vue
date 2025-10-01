<script setup lang="ts">
import hljs from 'highlight.js/lib/core';
import json from 'highlight.js/lib/languages/json';
import xml from 'highlight.js/lib/languages/xml';
import 'highlight.js/styles/stackoverflow-dark.css';
import { Copy, Check } from 'lucide-vue-next';

hljs.registerLanguage('json', json);
hljs.registerLanguage('xml', xml);

interface Props {
  code: Record<string, any> | string;
  lang: 'json' | 'xml' | 'text';
}
const props = defineProps<Props>();

const code = computed(() => {
  if (typeof props.code === 'string') {
    return props.code;
  } else if (typeof props.code === 'object') {
    return JSON.stringify(props.code, null, 2);
  } else {
    throw new Error(`Unknown code: ${JSON.stringify(props.code)}`);
  }
});
const hlCode = computed(() => {
  if (props.lang === 'text') {
    return `<span class="text-xl">${code.value}</span>`;
  }
  return hljs.highlight(code.value, { language: props.lang }).value;
});

const copied = ref(false);
function copy() {
  navigator.clipboard.writeText(code.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1000);
}
</script>

<template>
  <div class="relative">
    <pre
      class="bg-black text-gray-400 p-2 rounded overflow-scroll no-scrollbar"
    ><Check v-if="copied" class="absolute right-3 top-3 size-5"/><Copy v-else class="absolute right-3 top-3 size-5 text-gray-500 hover:text-gray-400 cursor-pointer" @click="copy"/><span v-html="hlCode"></span></pre>
  </div>
</template>
