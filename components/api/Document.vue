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
  params: TParam[];
  responseSample: any;
  remark?: string;
}
defineProps<Props>();

const open = ref(false);

const host = window.location.protocol + '//' + window.location.host;
</script>

<template>
  <div class="space-y-5">
    <h2 class="flex items-center space-x-3 text-2xl font-semibold font-serif py-2">
      <span>{{ index }}. {{ name }}</span>
      <ApiDebugModal :initial-selected="name" />
    </h2>

    <div>
      <p class="font-semibold mb-2">简要描述</p>
      <p class="font-serif">{{ description }}</p>
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
    <div v-if="remark">
      <p class="font-semibold mb-2">备注:</p>
      <p>{{ remark }}</p>
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
