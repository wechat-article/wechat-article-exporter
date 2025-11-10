<script setup lang="ts">
import type { ChipColor } from '#ui/types';
import CredentialsDialog, { type CredentialState } from '~/components/global/CredentialsDialog.vue';
import { docsWebSite } from '~/config';
import { gotoLink } from '~/utils';

// const { loggedIn } = useUserSession();

// CredentialDialog 相关变量
const credentialsDialogOpen = ref(false);
const credentialState = ref<CredentialState>('inactive');
const credentialPendingCount = ref(0);
const credentialColor: ComputedRef<ChipColor> = computed<ChipColor>(() => {
  switch (credentialState.value) {
    case 'active':
      return 'green';
    case 'inactive':
      return 'gray';
    case 'warning':
      return 'amber';
    default:
      return 'gray';
  }
});

const credentialBadgeText = computed(() => {
  const count = credentialPendingCount.value;
  if (count <= 0) return '';
  return count > 9 ? '+' : `${count}`;
});
const isCredentialActive = computed(() => credentialState.value === 'active');

const authPanelOpen = ref(false);
</script>

<template>
  <ul class="hidden md:flex items-center gap-5">
    <!-- 通知 -->
    <!--    <li>-->
    <!--      <UTooltip text="通知">-->
    <!--        <UChip text="3" size="2xl" color="amber">-->
    <!--          <UIcon name="i-lucide:bell" class="action-icon" />-->
    <!--        </UChip>-->
    <!--      </UTooltip>-->
    <!--    </li>-->

    <!-- Credential -->
    <li>
      <CredentialsDialog
        v-model:open="credentialsDialogOpen"
        v-model:state="credentialState"
        @update:pending-count="credentialPendingCount = $event"
      />
      <UTooltip text="抓取 Credentials">
        <div class="relative">
          <UIcon
            @click="credentialsDialogOpen = true"
            name="i-lucide:dog"
            :class="[
              'size-7 cursor-pointer transition-colors',
              { 'text-zinc-400 hover:text-blue-500': !isCredentialActive },
              { 'text-green-500 hover:text-green-600': isCredentialActive },
            ]"
          />
          <span
            v-if="credentialBadgeText"
            class="absolute -top-1 -right-1 text-[10px] leading-none rounded-full bg-rose-500 text-white px-1.5 py-0.5 min-w-[16px] text-center"
          >
            {{ credentialBadgeText }}
          </span>
        </div>
      </UTooltip>
    </li>

    <!-- 文档 -->
    <li>
      <UTooltip text="文档">
        <UIcon
          name="i-lucide:book-open"
          @click="gotoLink(docsWebSite)"
          class="size-7 text-zinc-400 hover:text-blue-500 cursor-pointer transition-colors"
        />
      </UTooltip>
    </li>

    <!-- GitHub -->
    <li>
      <UTooltip text="GitHub">
        <UIcon
          @click="gotoLink('https://github.com/wechat-article/wechat-article-exporter')"
          name="i-lucide:github"
          class="size-7 text-zinc-400 hover:text-blue-500 cursor-pointer transition-colors"
        />
      </UTooltip>
    </li>

    <!-- 邮箱登录 -->
    <!--    <li>-->
    <!--      <UPopover v-model:open="authPanelOpen" :popper="{ placement: 'bottom-end' }" overlay>-->
    <!--        <UIcon :name="loggedIn ? 'i-lucide:user-check' : 'i-lucide:user'" class="action-icon" />-->

    <!--        <template #panel>-->
    <!--          <AuthPopoverPanel v-model:open="authPanelOpen" />-->
    <!--        </template>-->
    <!--      </UPopover>-->
    <!--    </li>-->
  </ul>
</template>
