export const AUTH_KEY_TTL_MS = 4 * 24 * 60 * 60 * 1000;
export const AUTH_KEY_TTL_SECONDS = AUTH_KEY_TTL_MS / 1000;

export type CookieEntity = Record<string, string | number | boolean>;

export interface StoredSessionRecord {
  token: string;
  cookies: CookieEntity[];
  expiresAt?: number;
}

export function computeAuthKeyExpiresAt(now = Date.now()): number {
  return now + AUTH_KEY_TTL_MS;
}

export class AccountSession {
  private readonly _token: string;
  private readonly _cookies: CookieEntity[];
  private readonly _expiresAt?: number;

  constructor(token: string, cookies: CookieEntity[], expiresAt?: number) {
    this._token = token;
    this._cookies = cookies;
    this._expiresAt = expiresAt;
  }

  static fromSetCookieStrings(token: string, cookies: string[], expiresAt = computeAuthKeyExpiresAt()): AccountSession {
    return new AccountSession(token, AccountSession.parse(cookies), expiresAt);
  }

  static fromStoredRecord(record: StoredSessionRecord): AccountSession {
    return new AccountSession(record.token, record.cookies, record.expiresAt);
  }

  static parse(cookies: string[]): CookieEntity[] {
    const cookieMap = new Map<string, CookieEntity>();

    for (const cookie of cookies) {
      const cookieObj: CookieEntity = {};
      const parts = cookie.split(';').map(part => part.trim());
      const [nameValue] = parts;
      if (!nameValue) {
        continue;
      }

      const [name, ...valueParts] = nameValue.split('=');
      const cookieName = name.trim();
      if (!cookieName) {
        continue;
      }

      cookieObj.name = cookieName;
      cookieObj.value = valueParts.join('=').trim();

      for (const part of parts.slice(1)) {
        const [key, ...attributeParts] = part.split('=');
        if (!key) {
          continue;
        }

        const attributeName = key.toLowerCase();
        const attributeValue = attributeParts.join('=').trim();
        cookieObj[attributeName] = attributeValue || true;

        if (attributeName === 'expires' && attributeValue) {
          const timestamp = Date.parse(attributeValue);
          if (!Number.isNaN(timestamp)) {
            cookieObj.expires_timestamp = timestamp;
          }
        }
      }

      cookieMap.set(cookieName, cookieObj);
    }

    return Array.from(cookieMap.values());
  }

  public get token(): string {
    return this._token;
  }

  public get expiresAt(): number | undefined {
    return this._expiresAt;
  }

  public get(name: string): CookieEntity | undefined {
    return this._cookies.find(cookie => cookie.name === name);
  }

  public isExpiredAt(now = Date.now()): boolean {
    return typeof this._expiresAt === 'number' && this._expiresAt <= now;
  }

  public toCookieHeader(now = Date.now()): string {
    if (this.isExpiredAt(now)) {
      return '';
    }

    return this._cookies
      .filter(cookie => {
        if (!cookie.value || cookie.value === 'EXPIRED') {
          return false;
        }

        if (typeof cookie.expires_timestamp === 'number') {
          return cookie.expires_timestamp > now;
        }

        return true;
      })
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }

  public toJSON(): StoredSessionRecord {
    return {
      token: this._token,
      cookies: this._cookies,
      expiresAt: this._expiresAt,
    };
  }
}

export class AuthSessionCache {
  private readonly store = new Map<string, AccountSession>();
  private readonly maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  get(authKey: string, now = Date.now()): AccountSession | null {
    const session = this.store.get(authKey);
    if (!session) {
      return null;
    }

    if (session.isExpiredAt(now)) {
      this.store.delete(authKey);
      return null;
    }

    this.store.delete(authKey);
    this.store.set(authKey, session);
    return session;
  }

  set(authKey: string, session: AccountSession): void {
    this.store.delete(authKey);
    this.evictIfNeeded();
    this.store.set(authKey, session);
  }

  delete(authKey: string): void {
    this.store.delete(authKey);
  }

  toJSON(): Record<string, StoredSessionRecord> {
    const json: Record<string, StoredSessionRecord> = {};
    for (const [authKey, session] of this.store) {
      json[authKey] = session.toJSON();
    }
    return json;
  }

  private evictIfNeeded(): void {
    while (this.store.size >= this.maxSize) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) {
        break;
      }
      this.store.delete(oldestKey);
    }
  }
}
