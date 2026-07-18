<script setup lang="ts">
import CodeSegment from '~/components/api/CodeSegment.vue';

interface TParam {
  name: string;
  location: string;
  label: string;
  required: boolean;
  default: string;
  type: string;
  remark: string;
}

interface Props {
  index: number;
  name: string;
  description: string;
  url: string;
  method: string;
  offline?: boolean;
  rateLimit?: { guest: string; member: string };
  params: TParam[];
  responseSample: any;
  remark?: string;
}
defineProps<Props>();

// 会员/限速层：关闭时不展示「调用频率」行
const membershipEnabled = useRuntimeConfig().public.membership.enabled;

const open = ref(false);

const host = window.location.protocol + '//' + window.location.host;
</script>

<template>
  <div class="space-y-5">
    <h2 class="flex items-center space-x-3 text-2xl font-semibold font-serif py-2">
      <span :class="offline ? 'line-through text-gray-400 dark:text-gray-500' : ''">{{ index }}. {{ name }}</span>
      <UBadge v-if="offline" color="red" variant="subtle" size="xs">已下线</UBadge>
      <ApiDebugModal v-else :initial-selected="name" />
    </h2>
    <p v-if="offline" class="text-rose-500 text-sm">
      ⚠️ 该接口已下线，不再提供服务，此文档仅作历史保留。
    </p>

    <div>
      <p class="font-semibold mb-2">简要描述</p>
      <p class="font-serif">{{ description }}</p>
    </div>
    <div v-if="rateLimit && membershipEnabled" class="flex flex-wrap items-center gap-2 text-sm">
      <span class="font-semibold">调用频率:</span>
      <span class="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2 py-0.5 dark:bg-gray-800">
        <span class="text-gray-500">游客</span>
        <span class="font-medium">{{ rateLimit.guest }}</span>
      </span>
      <span
        class="inline-flex items-center gap-1.5 rounded-md bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
      >
        <UIcon name="i-lucide:crown" class="size-3.5" />
        <span>会员</span>
        <span class="font-medium">{{ rateLimit.member }}</span>
      </span>
    </div>
    <div v-if="remark">
      <p class="font-semibold mb-2">备注:</p>
      <p class="text-rose-500">{{ remark }}</p>
    </div>
    <div>
      <p class="font-semibold mb-2">请求URL:</p>
      <p class="font-mono border p-2 rounded-md">
        <span class="text-gray-400">{{ host }}</span>
        <span class="font-semibold">{{ url }}</span>
      </p>
    </div>
    <div>
      <p class="font-semibold mb-2">请求方式:</p>
      <p class="font-mono border p-2 rounded-md">{{ method }}</p>
    </div>
    <div>
      <p class="font-semibold mb-2">参数:</p>
      <div class="border rounded-md overflow-hidden">
        <table class="font-mono">
          <thead>
            <tr>
              <th>参数名</th>
              <th>参数位置</th>
              <th>强制</th>
              <th>默认值</th>
              <th>类型</th>
              <th>说明</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in params" :key="p.name">
              <td>{{ p.name }}</td>
              <td>{{ p.location }}</td>
              <td>{{ p.required ? '是' : '否' }}</td>
              <td>{{ p.default }}</td>
              <td>{{ p.type }}</td>
              <td>{{ p.label }}</td>
              <td>{{ p.remark }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
    <div>
      <p class="font-semibold flex items-center mb-2">
        <span class="mr-3">返回示例:</span>
        <UToggle v-model="open" color="blue" on-icon="i-heroicons:eye" off-icon="i-heroicons:eye-slash" />
      </p>
      <CodeSegment v-if="open" :code="responseSample" lang="json" />
    </div>
  </div>
</template>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
}
th,
td {
  border: 1px solid #e5e7eb;
  padding: 8px;
  text-align: center;
}
thead {
  background-color: #00005506;
}
tr:nth-child(even) {
  background-color: #00005506;
}
</style>
