import { initAsyncFileLog } from '~/server/utils/async-log';

export default defineNitroPlugin(() => {
  initAsyncFileLog();
});
