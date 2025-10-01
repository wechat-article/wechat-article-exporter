<script setup lang="ts">
const { loggedIn, user, clear, openInPopup, session } = useUserSession();

const open = defineModel<boolean>('open', { default: false });

// 登入功能
const loginWithGitHub = async () => {
  deleteCookie('nuxt-auth-state');
  window.location.href = '/auth/github';
};
const loginWithGoogle = async () => {
  deleteCookie('nuxt-auth-state');
  window.location.href = '/auth/google';
};

// 登出功能
const logout = async () => {};

// 由于 nuxt-auth-utils 库在授权时的bug，在授权之前需要手动删除临时cookie
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
}

interface Action {
  id: string;
  name: string;
  onClick: () => Promise<void> | void;
}

function closePanel(): void {
  open.value = false;
}

const actions: Action[] = [
  {
    id: 'profile',
    name: '个人中心',
    onClick: async () => {
      closePanel();
      navigateTo('/dashboard/profile');
    },
  },
  {
    id: 'logout',
    name: '退出',
    onClick: async () => {
      closePanel();
      await clear();
    },
  },
];
</script>

<template>
  <div>
    <div v-if="loggedIn && user" class="min-w-60">
      <div class="py-5 flex flex-col items-center">
        <img :alt="user.username" :src="user.avatar" class="size-20 rounded-full" />
        <h2 class="flex items-center gap-1.5 pt-1 font-bold">
          <span>{{ user.name }}</span>
          <UBadge
            :ui="{ rounded: 'rounded-full' }"
            :color="user.plan === 'pro' ? 'fuchsia' : 'gray'"
            variant="subtle"
            size="xs"
            class="px-2 font-mono font-bold"
            >{{ user.plan }}</UBadge
          >
        </h2>
        <div class="flex items-center gap-1.5">
          <UIcon v-if="user.provider === 'GitHub'" name="i-logos:github-icon" class="text-gray-200" />
          <UIcon v-if="user.provider === 'Google'" name="i-logos:google-icon" class="text-gray-200" />
          <span>{{ user.username }}</span>
        </div>
        <div class="mt-3" v-if="user.plan === 'free'">
          <!--          <UButton>订阅 Pro 会员</UButton>-->
          <UButton
            :ui="{ rounded: 'rounded-full', padding: { sm: 'px-5' } }"
            class="flex gap-2 items-center rounded-full border-2 border-primary text-primary font-medium bg-white hover:bg-primary hover:text-white transition-colors px-5 py-1.5 text-sm"
            >订阅 Pro 会员 (10元/月)</UButton
          >
        </div>
      </div>
      <div class="w-full">
        <ul>
          <li
            v-for="action in actions"
            :key="action.id"
            class="px-4 border-t border-gray-200/50 flex justify-between items-center hover:bg-gray-100/60"
          >
            <a @click="action.onClick" class="flex-1 py-2.5 cursor-pointer">{{ action.name }}</a>
          </li>
        </ul>
      </div>
    </div>

    <!-- Providers -->
    <div v-else class="py-5 flex flex-col p-3 min-w-60">
      <p class="font-serif">Log into with</p>
      <div class="space-y-3 my-3">
        <!-- GitHub -->
        <UButton @click="loginWithGitHub" block color="white" size="xl" icon="i-logos:github-icon">GitHub</UButton>

        <!-- Google -->
        <UButton @click="loginWithGoogle" block color="white" size="xl" icon="i-logos:google-icon">Google</UButton>
      </div>
    </div>
  </div>
</template>
