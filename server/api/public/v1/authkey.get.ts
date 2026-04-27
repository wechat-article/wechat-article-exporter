import {
  getSessionByAuthKey,
  issueApiTokenForAuthKey,
  resolveAuthKeyFromEvent,
} from '~/server/services/api/auth-session';

export default defineEventHandler(async event => {
  const authKey = await resolveAuthKeyFromEvent(event);
  const session = await getSessionByAuthKey(authKey);

  if (authKey && session) {
    const apiToken = await issueApiTokenForAuthKey(authKey);
    if (!apiToken) {
      return {
        code: -1,
        msg: 'API token issue failed',
      };
    }

    return {
      code: 0,
      data: apiToken,
    };
  } else {
    return {
      code: -1,
      msg: 'AuthKey not found',
    };
  }
});
