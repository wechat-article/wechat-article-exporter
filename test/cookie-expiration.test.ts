import assert from 'node:assert/strict';
import test from 'node:test';
import { getCookieExpirationState } from '../server/utils/cookie-expiration.ts';

test('cookie collection without expiration metadata stays active', () => {
  const state = getCookieExpirationState(
    [{ name: 'session', value: 'abc' }],
    new Date('2026-01-01T00:00:00Z').getTime()
  );

  assert.equal(state, 'active');
});

test('cookie collection is expired when every expiring cookie is expired', () => {
  const now = new Date('2026-01-01T00:00:00Z').getTime();

  const state = getCookieExpirationState(
    [
      { name: 'old-session', value: 'abc', expires_timestamp: now - 1 },
      { name: 'expired-marker', value: 'EXPIRED' },
    ],
    now
  );

  assert.equal(state, 'expired');
});

test('cookie collection remains active while any expiring cookie is still valid', () => {
  const now = new Date('2026-01-01T00:00:00Z').getTime();

  const state = getCookieExpirationState(
    [
      { name: 'old-session', value: 'abc', expires_timestamp: now - 1 },
      { name: 'fresh-session', value: 'def', expires_timestamp: now + 1 },
    ],
    now
  );

  assert.equal(state, 'active');
});
