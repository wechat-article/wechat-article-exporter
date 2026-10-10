export type CookieExpirationState = 'active' | 'expired';

type CookieWithExpiration = {
  name?: string | number;
  value?: string | number;
  expires?: string | number;
  expires_timestamp?: string | number;
};

function getExpiresTimestamp(cookie: CookieWithExpiration): number | null {
  if (typeof cookie.expires_timestamp === 'number') {
    return cookie.expires_timestamp;
  }

  if (typeof cookie.expires_timestamp === 'string') {
    const timestamp = Number(cookie.expires_timestamp);
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  if (typeof cookie.expires === 'string' || typeof cookie.expires === 'number') {
    const timestamp = Date.parse(String(cookie.expires));
    return Number.isNaN(timestamp) ? null : timestamp;
  }

  return null;
}

export function getCookieExpirationState(cookies: CookieWithExpiration[], now = Date.now()): CookieExpirationState {
  if (cookies.length === 0) {
    return 'expired';
  }

  const hasActiveCookie = cookies.some(cookie => {
    if (!cookie.value || cookie.value === 'EXPIRED') {
      return false;
    }

    const expiresTimestamp = getExpiresTimestamp(cookie);
    return expiresTimestamp === null || expiresTimestamp > now;
  });

  return hasActiveCookie ? 'active' : 'expired';
}
