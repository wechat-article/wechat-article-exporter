import { getAuthKey } from '~/server/utils/proxy-request';

export default defineEventHandler(async event => {
  const authKey = getAuthKey(event);

  if (authKey) {
    return {
      code: 0,
      data: authKey,
    };
  } else {
    return {
      code: -1,
      msg: 'AuthKey not found',
    };
  }
});
