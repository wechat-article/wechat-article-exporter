<script setup lang="ts">
import { gotoLink } from '~/utils';
import { docsWebSite } from '~/config';
import CredentialsDialog, { type CredentialState } from '~/components/global/CredentialsDialog.vue';
import AuthPopoverPanel from '~/components/dashboard/AuthPopoverPanel.vue';
import type { ChipColor } from '#ui/types';

const { loggedIn } = useUserSession();

// CredentialDialog 相关变量
const credentialsDialogOpen = ref(false);
const credentialState = ref<CredentialState>('inactive');
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

const authPanelOpen = ref(false);
</script>

<template>
  <ul class="hidden md:flex items-center gap-5">
    <!-- 通知 -->
    <li>
      <UTooltip text="通知">
        <UChip text="3" size="2xl" color="amber">
          <UIcon name="i-lucide:bell" class="action-icon" />
        </UChip>
      </UTooltip>
    </li>

    <!-- Credential -->
    <li>
      <CredentialsDialog v-model:open="credentialsDialogOpen" v-model:state="credentialState" />
      <UTooltip text="抓取 Credentials">
        <!-- todo: 优化图标的显示 -->
        <!--        <UChip size="md" :color="credentialColor">-->
        <!--        </UChip>-->
        <UIcon @click="credentialsDialogOpen = true" name="i-lucide:dog" class="action-icon" />
      </UTooltip>
    </li>

    <!-- 文档 -->
    <li>
      <UTooltip text="文档">
        <UIcon name="i-lucide:book-open" @click="gotoLink(docsWebSite)" class="action-icon" />
      </UTooltip>
    </li>

    <!-- GitHub -->
    <li>
      <UTooltip text="GitHub">
        <UIcon
          @click="gotoLink('https://github.com/jooooock/wechat-article-exporter')"
          name="i-lucide:github"
          class="action-icon"
        />
      </UTooltip>
    </li>

    <!-- 邮箱登录 -->
    <li>
      <UPopover v-model:open="authPanelOpen" :popper="{ placement: 'bottom-end' }" overlay>
        <UIcon :name="loggedIn ? 'i-lucide:user-check' : 'i-lucide:user'" class="action-icon" />

        <template #panel>
          <AuthPopoverPanel v-model:open="authPanelOpen" />
        </template>
      </UPopover>
    </li>
  </ul>
</template>

<style scoped>
.action-icon {
  @apply text-zinc-400 hover:text-blue-500 cursor-pointer size-7;
}
</style>
