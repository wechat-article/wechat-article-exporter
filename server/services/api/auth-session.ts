import { H3Event, parseCookies } from 'h3';
import { extractSetCookieValues } from '../../utils/set-cookie';

import {
  deleteApiToken,
  deleteApiTokenByAuthKey,
  getApiToken,
  getApiTokenByAuthKey,
  setApiToken,
  setApiTokenByAuthKey,
} from '../../kv/api-token';
import { deleteMpCookie, getMpCookie, setMpCookie } from '../../kv/cookie';
import {
  AccountSession,
  AUTH_KEY_TTL_MS,
  AUTH_KEY_TTL_SECONDS,
  AuthSessionCache,
  computeAuthKeyExpiresAt,
} from './session-core';

export const sessionCache = new AuthSessionCache();

async function resolveAuthKeyFromApiToken(token: string, now = Date.now()): Promise<string | null> {
  const record = await getApiToken(token);
  if (!record) {
    return null;
  }

  if (record.expiresAt <= now) {
    await deleteApiToken(token);
    await deleteApiTokenByAuthKey(record.authKey);
    return null;
  }

  return record.authKey;
}

export async function getSessionByAuthKey(authKey?: string | null, now = Date.now()): Promise<AccountSession | null> {
  if (!authKey) {
    return null;
  }

  const cachedSession = sessionCache.get(authKey, now);
  if (cachedSession) {
    return cachedSession;
  }

  const storedSession = await getMpCookie(authKey);
  if (!storedSession) {
    return null;
  }

  const session = AccountSession.fromStoredRecord(storedSession);
  if (session.isExpiredAt(now)) {
    await deleteMpCookie(authKey);
    return null;
  }

  sessionCache.set(authKey, session);
  return session;
}

export async function getResolvedSessionFromEvent(event: H3Event, now = Date.now()): Promise<AccountSession | null> {
  const headerCredential = getRequestHeader(event, 'X-Auth-Key');
  if (headerCredential) {
    const directSession = await getSessionByAuthKey(headerCredential, now);
    if (directSession) {
      return directSession;
    }

    const resolvedAuthKey = await resolveAuthKeyFromApiToken(headerCredential, now);
    if (resolvedAuthKey) {
      return getSessionByAuthKey(resolvedAuthKey, now);
    }
  }

  const cookies = parseCookies(event);
  return getSessionByAuthKey(cookies['auth-key'], now);
}

export async function persistSession(
  authKey: string,
  token: string,
  cookies: string[],
  now = Date.now()
): Promise<AccountSession | null> {
  const session = AccountSession.fromSetCookieStrings(token, cookies, computeAuthKeyExpiresAt(now));
  sessionCache.set(authKey, session);

  const success = await setMpCookie(authKey, session.toJSON());
  if (!success) {
    sessionCache.delete(authKey);
    return null;
  }

  return session;
}

export async function revokeSession(authKey?: string | null): Promise<void> {
  if (!authKey) {
    return;
  }

  const apiToken = await getApiTokenByAuthKey(authKey);
  sessionCache.delete(authKey);
  await deleteMpCookie(authKey);
  await deleteApiTokenByAuthKey(authKey);
  if (apiToken) {
    await deleteApiToken(apiToken);
  }
}

export async function revokeSessionFromEvent(event: H3Event, now = Date.now()): Promise<void> {
  const authKey = await resolveAuthKeyFromEvent(event, now);
  if (!authKey) {
    return;
  }

  await revokeSession(authKey);
}

export function extractAuthKeyFromEvent(event: H3Event): string {
  const headerAuthKey = getRequestHeader(event, 'X-Auth-Key');
  if (headerAuthKey) {
    return headerAuthKey;
  }

  const cookies = parseCookies(event);
  return cookies['auth-key'];
}

export async function resolveAuthKeyFromEvent(event: H3Event, now = Date.now()): Promise<string | null> {
  const headerCredential = getRequestHeader(event, 'X-Auth-Key');
  if (headerCredential) {
    const directSession = await getSessionByAuthKey(headerCredential, now);
    if (directSession) {
      return headerCredential;
    }

    return resolveAuthKeyFromApiToken(headerCredential, now);
  }

  const cookies = parseCookies(event);
  return cookies['auth-key'] || null;
}

export async function getCookieHeaderFromEvent(event: H3Event, now = Date.now()): Promise<string | null> {
  const session = await getResolvedSessionFromEvent(event, now);
  if (!session) {
    return null;
  }

  const cookieHeader = session.toCookieHeader(now);
  return cookieHeader || null;
}

export async function getTokenFromEvent(event: H3Event, now = Date.now()): Promise<string | null> {
  const session = await getResolvedSessionFromEvent(event, now);
  return session?.token || null;
}

export function getCookiesFromRequest(event: H3Event): string {
  const cookies = parseCookies(event);
  return ['uuid']
    .filter(key => !!cookies[key])
    .map(key => `${key}=${encodeURIComponent(cookies[key])}`)
    .join(';');
}

export function getCookieValueFromResponse(name: string, response: Response): string | null {
  const cookies = AccountSession.parse(extractSetCookieValues(response.headers));
  const targetCookie = cookies.find(cookie => cookie.name === name);
  if (!targetCookie) {
    return null;
  }

  return targetCookie.value as string;
}

export function getSessionCacheSnapshot() {
  return sessionCache.toJSON();
}

export async function issueApiTokenForAuthKey(authKey: string, now = Date.now()): Promise<string | null> {
  const existingToken = await getApiTokenByAuthKey(authKey);
  if (existingToken) {
    const existingRecord = await getApiToken(existingToken);
    if (existingRecord && existingRecord.expiresAt > now) {
      return existingToken;
    }

    await deleteApiToken(existingToken);
    await deleteApiTokenByAuthKey(authKey);
  }

  const token = crypto.randomUUID().replace(/-/g, '');
  const expiresAt = now + AUTH_KEY_TTL_MS;
  const tokenWritten = await setApiToken(token, { authKey, expiresAt }, AUTH_KEY_TTL_SECONDS);
  const reverseWritten = tokenWritten && (await setApiTokenByAuthKey(authKey, token, AUTH_KEY_TTL_SECONDS));

  if (!tokenWritten || !reverseWritten) {
    await deleteApiToken(token);
    await deleteApiTokenByAuthKey(authKey);
    return null;
  }

  return token;
}
