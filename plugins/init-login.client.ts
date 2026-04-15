import type { LoginAccount } from '~/types/types';

const loginAccountReady = ref(false);

export default defineNuxtPlugin(nuxtApp => {
  nuxtApp.hook('app:mounted', async () => {
    const loginAccount = useLoginAccount();

    if (loginAccountReady.value) {
      return;
    }

    try {
      loginAccount.value = await $fetch<LoginAccount | null>('/api/web/login/account');
    } catch {
      loginAccount.value = null;
    } finally {
      loginAccountReady.value = true;
    }
  });
});