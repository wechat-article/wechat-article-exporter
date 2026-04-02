import { getPool } from '~/server/db/postgres';
import { type CookieEntity } from '~/server/utils/CookieStore';

export type CookieKVKey = string;

export interface CookieKVValue {
  token: string;
  cookies: CookieEntity[];
}

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 4; // 4 days

export async function setMpCookie(key: CookieKVKey, data: CookieKVValue): Promise<boolean> {
  const pool = getPool();
  try {
    const now = Math.round(Date.now() / 1000);
    const expiresAt = now + SESSION_TTL_SECONDS;
    await pool.query(
      `INSERT INTO session (auth_key, token, cookies, created_at, expires_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (auth_key) DO UPDATE SET
         token = EXCLUDED.token,
         cookies = EXCLUDED.cookies,
         created_at = EXCLUDED.created_at,
         expires_at = EXCLUDED.expires_at`,
      [key, data.token, JSON.stringify(data.cookies), now, expiresAt]
    );
    return true;
  } catch (err) {
    console.error('session insert failed:', err);
    return false;
  }
}

export async function getMpCookie(key: CookieKVKey): Promise<CookieKVValue | null> {
  const pool = getPool();
  try {
    const now = Math.round(Date.now() / 1000);
    const res = await pool.query(
      `SELECT token, cookies FROM session WHERE auth_key = $1 AND expires_at > $2`,
      [key, now]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      token: row.token,
      cookies: row.cookies,
    };
  } catch (err) {
    console.error('session query failed:', err);
    return null;
  }
}

export async function removeMpCookie(key: CookieKVKey): Promise<boolean> {
  const pool = getPool();
  try {
    await pool.query(`DELETE FROM session WHERE auth_key = $1`, [key]);
    return true;
  } catch (err) {
    console.error('session delete failed:', err);
    return false;
  }
}

export async function removeAllSessions(): Promise<boolean> {
  const pool = getPool();
  try {
    await pool.query(`DELETE FROM session`);
    return true;
  } catch (err) {
    console.error('session clear failed:', err);
    return false;
  }
}

export async function cleanExpiredSessions(): Promise<void> {
  const pool = getPool();
  try {
    const now = Math.round(Date.now() / 1000);
    await pool.query(`DELETE FROM session WHERE expires_at <= $1`, [now]);
  } catch (err) {
    console.error('session cleanup failed:', err);
  }
}
