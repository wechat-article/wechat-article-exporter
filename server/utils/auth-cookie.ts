import dayjs from 'dayjs';

export const AUTH_KEY_COOKIE_NAME = 'auth-key';
export const AUTH_KEY_COOKIE_TTL_DAYS = 4;
export const AUTH_COOKIE_SAMESITE = 'Lax';

function formatCookieExpires(date: Date): string {
  return date.toUTCString();
}

export function createAuthKeySetCookieHeader(authKey: string, now: Date = new Date()): string {
  return [
    `${AUTH_KEY_COOKIE_NAME}=${encodeURIComponent(authKey)}`,
    'Path=/',
    `Expires=${formatCookieExpires(dayjs(now).add(AUTH_KEY_COOKIE_TTL_DAYS, 'days').toDate())}`,
    'Secure',
    'HttpOnly',
    `SameSite=${AUTH_COOKIE_SAMESITE}`,
  ].join('; ');
}

export function createExpiredUuidSetCookieHeader(now: Date = new Date()): string {
  return [
    'uuid=EXPIRED',
    'Path=/',
    'Max-Age=0',
    `Expires=${formatCookieExpires(dayjs(now).subtract(1, 'days').toDate())}`,
    'Secure',
    'HttpOnly',
    `SameSite=${AUTH_COOKIE_SAMESITE}`,
  ].join('; ');
}
