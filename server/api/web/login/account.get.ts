import { parseCookies, setCookie as setResponseCookie } from 'h3';
import { getPool } from '~/server/db/postgres';
import { cookieStore } from '~/server/utils/CookieStore';

const AUTH_KEY_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 4;

export default defineEventHandler(async (event) => {
  const authKey = getRequestHeader(event, 'X-Auth-Key') || parseCookies(event)['auth-key'];
  if (!authKey) {
    return null;
  }

  const pool = getPool();
  const now = Math.round(Date.now() / 1000);
  const sessionRes = await pool.query(
    `SELECT nickname, avatar, expires_at
     FROM session
     WHERE auth_key = $1 AND expires_at > $2
     LIMIT 1`,
    [authKey, now],
  );

  const accountCookie = await cookieStore.getAccountCookie(authKey);
  const expiresAt = accountCookie?.expiresAt || null;

  if (sessionRes.rows.length === 0 || !accountCookie || accountCookie.isExpired) {
    setResponseCookie(event, 'auth-key', 'EXPIRED', {
      path: '/',
      expires: new Date(0),
      maxAge: 0,
      httpOnly: true,
      sameSite: 'lax',
    });
    return null;
  }

  setResponseCookie(event, 'auth-key', authKey, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: AUTH_KEY_COOKIE_MAX_AGE_SECONDS,
    expires: new Date((now + AUTH_KEY_COOKIE_MAX_AGE_SECONDS) * 1000),
  });

  const row = sessionRes.rows[0];
  return {
    nickname: row.nickname || '',
    avatar: row.avatar || '',
    expires: new Date(expiresAt || row.expires_at * 1000).toString(),
  };
});