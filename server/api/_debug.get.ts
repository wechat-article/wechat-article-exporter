import { getSessionCacheSnapshot } from '~/server/services/api/auth-session';

export default defineEventHandler(async event => {
  if (process.env.NODE_ENV !== 'development') {
    throw createError({ statusCode: 404, statusMessage: 'Not Found' });
  }

  const debugKey = getRequestHeader(event, 'x-debug-key');
  if (!debugKey || debugKey !== process.env.DEBUG_KEY) {
    throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
  }

  return {
    activeSessions: Object.keys(getSessionCacheSnapshot()).length,
  };
});
