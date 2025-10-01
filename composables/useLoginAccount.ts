import type { LoginAccount } from '~/types/types';
import { StorageSerializers } from '@vueuse/core';

export default () => {
  return useLocalStorage<LoginAccount>('login', null, {
    serializer: StorageSerializers.object,
  });
};
