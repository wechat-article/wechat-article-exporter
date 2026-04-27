import assert from 'node:assert/strict';

import { AccountSession, AuthSessionCache, computeAuthKeyExpiresAt } from '../../server/services/api/session-core';

function run() {
  const session = AccountSession.fromSetCookieStrings('token-1', [
    'foo=bar; Path=/; HttpOnly',
    'foo=baz; Path=/; Secure',
    'uuid=EXPIRED; Path=/',
  ]);

  assert.equal(session.get('foo')?.value, 'baz');
  assert.equal(session.toCookieHeader().includes('foo=baz'), true);
  assert.equal(session.toCookieHeader().includes('uuid=EXPIRED'), false);

  const expiringSession = AccountSession.fromSetCookieStrings('token-1', ['foo=bar; Path=/'], 1_000);
  assert.equal(expiringSession.isExpiredAt(999), false);
  assert.equal(expiringSession.isExpiredAt(1_000), true);
  assert.equal(expiringSession.toCookieHeader(1_000), '');

  const mixedExpirySession = AccountSession.fromSetCookieStrings('token-2', [
    'foo=bar; Expires=Wed, 01 Jan 2025 00:00:00 GMT',
    'baz=qux; Expires=Wed, 01 Jan 2031 00:00:00 GMT',
  ]);
  assert.equal(mixedExpirySession.toCookieHeader(Date.parse('2026-01-01T00:00:00Z')), 'baz=qux');

  assert.equal(computeAuthKeyExpiresAt(10), 10 + 4 * 24 * 60 * 60 * 1000);

  const cache = new AuthSessionCache(10);
  cache.set('auth-1', AccountSession.fromSetCookieStrings('token-1', ['foo=bar; Path=/'], 100));
  assert.equal(cache.get('auth-1', 101), null);
  assert.deepEqual(cache.toJSON(), {});

  console.log('session-core regression checks passed');
}

run();
