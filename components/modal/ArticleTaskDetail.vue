<script setup lang="ts">
interface DetailItem {
  title: string;
  publishTime: string;
  url: string;
}

const props = withDefaults(
  defineProps<{
    title: string;
    description?: string;
    items: DetailItem[];
    collapsedCount?: number;
  }>(),
  {
    description: '',
    collapsedCount: 10,
  }
);

const modal = useModal();
const expanded = ref(false);

const canExpand = computed(() => props.items.length > props.collapsedCount);
const visibleItems = computed(() => {
  if (expanded.value) {
    return props.items;
  }
  return props.items.slice(0, props.collapsedCount);
});

function closeModal() {
  modal.close();
}
</script>

<template>
  <UModal prevent-close>
    <UCard>
      <template #header>
        <div class="flex items-start justify-between gap-3">
          <div class="space-y-1">
            <h3 class="text-base font-semibold">{{ title }}</h3>
            <p v-if="description" class="text-sm text-gray-500">
              {{ description }}
            </p>
          </div>
          <UButton square variant="link" color="gray" icon="i-lucide:x" @click="closeModal" />
        </div>
      </template>

      <div class="space-y-3">
        <div class="text-sm text-gray-500">
          共 {{ items.length }} 篇，当前展示 {{ visibleItems.length }} 篇
        </div>

        <div class="max-h-[380px] overflow-auto rounded border border-gray-200 p-2">
          <div v-if="visibleItems.length === 0" class="text-sm text-gray-500">暂无明细</div>
          <div v-else class="space-y-2">
            <div
              v-for="(item, index) in visibleItems"
              :key="item.url"
              class="rounded border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div class="text-sm font-medium break-all">{{ index + 1 }}. {{ item.title }}</div>
              <div class="mt-1 text-xs text-gray-500">发布时间：{{ item.publishTime }}</div>
            </div>
          </div>
        </div>

        <div v-if="canExpand" class="flex justify-end">
          <UButton
            variant="ghost"
            color="gray"
            :label="expanded ? '收起' : `展开全部（${items.length}）`"
            @click="expanded = !expanded"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end">
          <UButton color="primary" @click="closeModal">我知道了</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
