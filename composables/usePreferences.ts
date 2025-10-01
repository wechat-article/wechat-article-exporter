import { StorageSerializers } from '@vueuse/core';
import type { Preferences } from '~/types/preferences';

const defaultOptions: Partial<Preferences> = {
  hideDeleted: true,
  privateProxyList: [],
  privateProxyAuthorization: '',
  exportConfig: {
    dirname: '${title}',
    exportExcelIncludeContent: false,
    exportJsonIncludeComments: false,
    exportJsonIncludeContent: false,
    exportHtmlIncludeComments: false,
  },
  downloadConfig: {
    forceDownloadContent: false,
  },
  accountSyncSeconds: 5,
  api_auth: null,
  syncDateRange: 'all',
};

export default () => {
  //@ts-ignore
  return useLocalStorage<Preferences>('preferences', defaultOptions, {
    serializer: StorageSerializers.object,
    mergeDefaults: true,
  });
};
