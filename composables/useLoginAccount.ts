import type { LoginAccount as LoginAccountState } from '~/types/types';

const loginAccount = ref<LoginAccountState | null>(null);

export default () => {
  return loginAccount;
};
