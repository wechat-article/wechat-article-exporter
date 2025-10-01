import type { AccountInfo, AuthorInfo } from '~/types/types';
import { StorageSerializers } from '@vueuse/core';

export default () => {
  return useLocalStorage<AccountInfo | AuthorInfo | null>('account', null, {
    serializer: StorageSerializers.object,
  });
};
