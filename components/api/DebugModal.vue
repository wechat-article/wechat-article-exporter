<script setup lang="ts">
import { apis } from '~/config';
import type { FormError } from '#ui/types';
import CodeSegment from '~/components/api/CodeSegment.vue';
import type { Preferences } from '~/types/preferences';
import usePreferences from '~/composables/usePreferences';

interface Props {
  initialSelected: string;
}
const props = defineProps<Props>();

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

const isOpen = ref(false);
const selectedApi = ref(apis[0]);

const payload: Ref<Record<string, any>> = ref({});

const host = window.location.protocol + '//' + window.location.host;

function onOpen() {
  isOpen.value = true;
  selectedApi.value = apis.find(api => api.name === props.initialSelected)!;
}

function apiChange() {
  payload.value = {};
}

function isEmpty(key: string, obj: Record<string, any>): boolean {
  if (!obj.hasOwnProperty(key)) {
    return true;
  }
  let value = obj[key];
  if (typeof value === 'string') {
    value = value.trim();
  }
  return value === undefined || value === null || value === '';
}

function validate(state: Record<string, any>): FormError[] {
  const errors: FormError[] = [];

  selectedApi.value.params.forEach(param => {
    if (param.required && isEmpty(param.name, state)) {
      errors.push({ path: param.name, message: param.name + '不能为空' });
    }
    if (!isEmpty(param.name, state) && param.type === 'Int') {
      if (Number.isNaN(parseInt(state[param.name]))) {
        errors.push({ path: param.name, message: param.name + '格式不正确' });
      } else if (parseInt(state[param.name]) < 0) {
        errors.push({ path: param.name, message: param.name + '不得小于0' });
      }
    }
  });

  return errors;
}

const resp = ref<Record<string, any> | null | string>(null);
const hasResponse = computed(() => {
  return typeof resp.value === 'string' || (typeof resp.value === 'object' && resp.value);
});
const btnLoading = ref(false);
function submit() {
  const params = toRaw(payload.value);

  let url = selectedApi.value.url;
  if (selectedApi.value.method === 'GET') {
    url += '?' + new URLSearchParams(params).toString();
  }

  const headers: Record<string, string> = {};
  if (preferences.value.api_auth) {
    headers['Authorization'] = preferences.value.api_auth.token;
  }

  btnLoading.value = true;
  resp.value = null;
  fetch(url, {
    method: selectedApi.value.method,
    headers: headers,
  })
    .then(resp => {
      if (resp.headers.get('content-type') === 'application/json') {
        return resp.json();
      } else {
        return resp.text();
      }
    })
    .then(data => {
      resp.value = data;
    })
    .finally(() => {
      btnLoading.value = false;
    });
}
</script>

<template>
  <div>
    <UTooltip text="在线调试" :popper="{ placement: 'top' }">
      <UButton color="blue" variant="ghost" square @click="onOpen" icon="i-lucide:bug-play"></UButton>
    </UTooltip>

    <USlideover v-model="isOpen" :ui="{ width: 'max-w-[800px]' }">
      <UCard
        class="flex flex-col flex-1"
        :ui="{
          body: { base: 'overflow-y-scroll h-[calc(100vh-72px)]' },
          ring: '',
          divide: 'divide-y divide-gray-100 dark:divide-gray-800',
        }"
      >
        <template #header>
          <h1 class="font-semibold text-2xl">在线接口调试工具</h1>
        </template>

        <div class="space-y-5">
          <div class="flex items-center gap-3">
            <span>选择接口: </span>
            <USelectMenu
              class="flex-1"
              v-model="selectedApi"
              :options="apis"
              option-attribute="name"
              @change="apiChange"
            >
              <template #label>
                <span
                  :class="[
                    selectedApi.method === 'GET' ? 'bg-green-400' : 'bg-fuchsia-400',
                    'inline-block size-2 flex-shrink-0 rounded-full',
                  ]"
                  aria-hidden="true"
                />
                <span class="font-medium">{{ selectedApi.name }}</span>
              </template>
              <template #option="{ option: api }">
                <div>
                  <p class="font-medium">
                    <span
                      :class="[
                        api.method === 'GET' ? 'bg-green-400' : 'bg-fuchsia-400',
                        'inline-block size-2 mr-2 flex-shrink-0 rounded-full',
                      ]"
                      aria-hidden="true"
                    />
                    <span>{{ api.name }}</span>
                  </p>
                  <p class="text-gray-400 font-mono">{{ api.description }}</p>
                </div>
              </template>
            </USelectMenu>
          </div>

          <div class="space-y-5">
            <div>
              <p class="font-semibold mb-2">请求URL:</p>
              <p class="font-mono border p-2 rounded-md">
                <span class="text-gray-400">{{ host }}</span>
                <span class="font-semibold">{{ selectedApi.url }}</span>
              </p>
            </div>
            <div>
              <p class="font-semibold mb-2">请求方式:</p>
              <p class="font-mono border p-2 rounded-md">{{ selectedApi.method }}</p>
            </div>
            <div>
              <p class="font-semibold mb-2">参数:</p>
              <UForm :state="payload" :validate="validate" @submit="submit" class="space-y-3">
                <UFormGroup
                  v-for="p in selectedApi.params"
                  :key="p.name"
                  :label="p.name"
                  :name="p.name"
                  :required="p.required"
                >
                  <UInput
                    v-model="payload[p.name]"
                    :type="p.type === 'Int' ? 'number' : 'text'"
                    :placeholder="p.label + (p.remark ? '，' + p.remark : '')"
                  />
                </UFormGroup>
                <UButton type="submit" color="black" class="px-5" :loading="btnLoading">提交</UButton>
              </UForm>
            </div>
          </div>
          <div v-if="hasResponse">
            <h3 class="font-bold text-2xl">响应</h3>
            <CodeSegment :code="resp!" :lang="typeof resp === 'object' ? 'json' : 'xml'" />
          </div>
        </div>
      </UCard>
    </USlideover>
  </div>
</template>
