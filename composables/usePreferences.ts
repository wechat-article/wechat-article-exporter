import { StorageSerializers } from '@vueuse/core';
import { MP_ORIGIN_TIMESTAMP } from '~/config';
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
    forceDownloadMetadata: false,
    forceDownloadComment: false,
  },
  accountSyncSeconds: 5,
  syncDateRange: 'all',
  syncDatePoint: MP_ORIGIN_TIMESTAMP,
  autoTask: {
    syncIntervalSeconds: 30,
    downloadIntervalSeconds: 5,
    exportIntervalSeconds: 1,
    retryIntervalSeconds: 60,
    maxConsecutiveErrors: 3,
    exportFilenameTemplate: '${YYYY}-${MM}-${DD} ${title}',
  },
  imageHost: {
    enabled: false,
    apiUrl: 'http://127.0.0.1:36677/upload',
    batchSize: 20,
  },
};

export default () => {
  //@ts-ignore
  return useLocalStorage<Preferences>('preferences', defaultOptions, {
    serializer: StorageSerializers.object,
    mergeDefaults: true,
  });
};
