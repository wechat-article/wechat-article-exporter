<script setup>
import { request } from '#shared/utils/request.ts';

function triggerClientException() {
  throw new Error('Nuxt dev diagnostics client exception');
}

async function triggerRequestObserver() {
  await request('/api/dev-diagnostics-missing-endpoint');
}
</script>

<template>
  <button id="errorBtn" @click="triggerClientException">Trigger Client Exception</button>
  <button type="button" @click="triggerRequestObserver">Trigger Request Observer</button>
</template>
