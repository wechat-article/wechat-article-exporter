<script setup lang="ts">
import CredentialsDialog, { type CredentialState } from '~/components/global/CredentialsDialog.vue';

const credentialsDialogOpen = ref(false);
const credentialState = ref<CredentialState>('inactive');
const credentialPendingCount = ref(0);

const credentialBadgeText = computed(() => {
  const count = credentialPendingCount.value;
  if (count <= 0) return '';
  return count > 9 ? '+' : `${count}`;
});
const isCredentialActive = computed(() => credentialState.value === 'active');
</script>

<template>
  <ul class="hidden md:flex items-center gap-3">
    <li>
      <CredentialsDialog
        v-model:open="credentialsDialogOpen"
        v-model:state="credentialState"
        @update:pending-count="credentialPendingCount = $event"
      />
      <UTooltip text="抓取登录凭证">
        <button
          type="button"
          class="relative grid size-9 place-items-center rounded-md border border-cc-border bg-cc-elevated shadow-sm transition hover:border-cc-border-strong hover:bg-white"
          aria-label="抓取登录凭证"
          @click="credentialsDialogOpen = true"
        >
          <UIcon
            name="i-heroicons-key-20-solid"
            :class="[
              'size-4 transition-colors',
              { 'text-cc-muted hover:text-cc-accent': !isCredentialActive },
              { 'text-cc-success hover:opacity-90': isCredentialActive },
            ]"
          />
          <span
            v-if="credentialBadgeText"
            class="absolute -top-1 -right-1 text-[10px] leading-none rounded-full bg-cc-danger text-white px-1.5 py-0.5 min-w-[16px] text-center"
          >
            {{ credentialBadgeText }}
          </span>
        </button>
      </UTooltip>
    </li>
  </ul>
</template>
