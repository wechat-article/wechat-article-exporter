import { describe, expect, it } from 'vitest';
import {
  AUTH_COOKIE_SAMESITE,
  AUTH_KEY_COOKIE_NAME,
  createAuthKeySetCookieHeader,
  createExpiredUuidSetCookieHeader,
} from '~/server/utils/auth-cookie';

describe('auth-cookie', () => {
  const now = new Date('2026-07-03T00:00:00.000Z');

  it('creates a hardened auth-key cookie header', () => {
    expect(createAuthKeySetCookieHeader('abc123', now)).toBe(
      [
        `${AUTH_KEY_COOKIE_NAME}=abc123`,
        'Path=/',
        'Expires=Tue, 07 Jul 2026 00:00:00 GMT',
        'Secure',
        'HttpOnly',
        `SameSite=${AUTH_COOKIE_SAMESITE}`,
      ].join('; '),
    );
  });

  it('encodes auth-key cookie values', () => {
    expect(createAuthKeySetCookieHeader('a b=1', now)).toContain(`${AUTH_KEY_COOKIE_NAME}=a%20b%3D1`);
  });

  it('creates an expired uuid cleanup cookie with the same browser boundary', () => {
    expect(createExpiredUuidSetCookieHeader(now)).toBe(
      [
        'uuid=EXPIRED',
        'Path=/',
        'Max-Age=0',
        'Expires=Thu, 02 Jul 2026 00:00:00 GMT',
        'Secure',
        'HttpOnly',
        `SameSite=${AUTH_COOKIE_SAMESITE}`,
      ].join('; '),
    );
  });
});
