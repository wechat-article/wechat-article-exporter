import { H3Event, parseCookies } from 'h3';
import { CookieKVValue, getMpCookie, setMpCookie } from '~/server/kv/cookie';

// 表示一条 set-cookie 记录的解析结果
export type CookieEntity = Record<string, string | number>;

// 公众号所有的 set-cookie 解析结果
export class AccountCookie {
  private readonly _token: string;
  private _cookie: CookieEntity[];

  /**
   * @param token
   * @param cookies response.headers.getSetCookie() 的结果，是一个字符串数组
   */
  constructor(token: string, cookies: string[]) {
    this._token = token;
    this._cookie = AccountCookie.parse(cookies);
  }

  static create(token: string, cookies: CookieEntity[]): AccountCookie {
    const value = new AccountCookie(token, []);
    value._cookie = cookies;
    return value;
  }

  public toString(): string {
    return this.stringify(this._cookie);
  }

  public toJSON(): CookieKVValue {
    return {
      token: this._token,
      cookies: this._cookie,
    };
  }

  public get(name: string): CookieEntity | undefined {
    return this._cookie.find(cookie => cookie.name === name);
  }

  public get token() {
    return this._token;
  }

  // 根据 cookie 中的 expires 来确定是否已过期
  public get isExpired(): boolean {
    // todo
    return false;
  }

  public static parse(cookies: string[]): CookieEntity[] {
    // key 为 cookie 的 name
    const cookieMap = new Map<string, CookieEntity>();

    for (const cookie of cookies) {
      const cookieObj: CookieEntity = {};
      // 分割 cookie 字符串为各个属性
      const parts = cookie.split(';').map(str => str.trim());

      // 第一个部分是name=value
      const [nameValue] = parts;
      if (nameValue) {
        const [name, ...valueParts] = nameValue.split('=');
        const cookieName = name.trim();
        cookieObj.name = cookieName;
        cookieObj.value = valueParts.join('=').trim(); // 处理值中可能包含的等号

        // 处理其他属性（如Expires, Path, Domain等）
        for (const part of parts.slice(1)) {
          const [key, ...valueParts] = part.split('=');
          const value = valueParts.join('=').trim(); // 处理值中可能包含的等号
          if (key) {
            const keyLower = key.toLowerCase();
            cookieObj[keyLower] = value || 'true'; // 无值属性（如HttpOnly）设为true

            // 如果是expires字段，添加时间戳
            if (keyLower === 'expires' && value) {
              try {
                const timestamp = Date.parse(value);
                if (!isNaN(timestamp)) {
                  cookieObj.expires_timestamp = timestamp; // 添加时间戳（毫秒）
                }
              } catch (e) {
                // 如果日期解析失败，忽略时间戳字段
              }
            }
          }
        }

        // Only add valid cookies to the map (overwrite if duplicate name)
        if (cookieObj.name) {
          cookieMap.set(cookieName, cookieObj);
        }
      }
    }

    return Array.from(cookieMap.values());
  }

  private stringify(parsedCookie: CookieEntity[]): string {
    return parsedCookie
      .filter(cookie => cookie.value && cookie.value !== 'EXPIRED')
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }
}

// 所有用户的 cookie 仓库
class CookieStore {
  // key 为 authKey, value 为 AccountCookie 实例
  store: Map<string, AccountCookie> = new Map<string, AccountCookie>();
  // key 为 authKey, value 为 ownerId
  ownerIdMap: Map<string, string> = new Map<string, string>();

  async getAccountCookie(authKey: string): Promise<AccountCookie | null> {
    // 优先从本地内存取
    let cachedAccountCookie = this.store.get(authKey);

    // 如果内存没有，则从 kv 数据库取
    if (!cachedAccountCookie) {
      const cookieValue = await getMpCookie(authKey);
      if (!cookieValue) {
        return null;
      }

      cachedAccountCookie = AccountCookie.create(cookieValue.token, cookieValue.cookies);
      this.store.set(authKey, cachedAccountCookie);
    }

    return cachedAccountCookie;
  }

  /**
   * 检索用户的cookie
   * @param authKey
   * @return 适合作为请求头的Cookie字符串
   */
  async getCookie(authKey: string): Promise<string | null> {
    const accountCookie = await this.getAccountCookie(authKey);
    if (!accountCookie) {
      return null;
    }
    return accountCookie.toString();
  }

  /**
   * 存储用户的cookie
   * @param authKey
   * @param token
   * @param cookie 原始的 set-cookie 字符串数组
   */
  async setCookie(authKey: string, token: string, cookie: string[]): Promise<boolean> {
    const accountCookie = new AccountCookie(token, cookie);
    this.store.set(authKey, accountCookie);
    return await setMpCookie(authKey, accountCookie.toJSON());
  }

  /**
   * 检索用户的 token
   * @param authKey
   */
  async getToken(authKey: string): Promise<string | null> {
    const accountCookie = await this.getAccountCookie(authKey);
    if (!accountCookie) {
      return null;
    }

    return accountCookie.token;
  }

  /**
   * 设置用户的 ownerId
   * @param authKey
   * @param ownerId
   */
  async setOwnerId(authKey: string, ownerId: string): Promise<boolean> {
    const kv = useStorage('kv');
    try {
      // 读取现有数据
      const existing = await getMpCookie(authKey);
      if (existing) {
        existing.ownerId = ownerId;
        await kv.set(`cookie:${authKey}`, existing, {
          expirationTtl: 60 * 60 * 24 * 4, // 4 days
        });
      } else {
        // 如果会话数据不存在（可能是刚创建），也尝试直接写入 ownerId
        // 这种情况下 setCookie 可能还在处理中，我们需要确保 ownerId 被保存
        console.warn(`setOwnerId: Session not found for authKey ${authKey.substring(0, 8)}..., saving ownerId to raw KV`);
        // 读取原始 KV 数据（绕过过期检查）
        const rawData = await kv.get<any>(`cookie:${authKey}`);
        if (rawData) {
          rawData.ownerId = ownerId;
          await kv.set(`cookie:${authKey}`, rawData, {
            expirationTtl: 60 * 60 * 24 * 4,
          });
        }
      }
      // 同时存储到内存中的映射
      this.ownerIdMap.set(authKey, ownerId);
      return true;
    } catch (err) {
      console.error('setOwnerId failed:', err);
      return false;
    }
  }

  /**
   * 获取用户的 ownerId
   * @param authKey
   */
  async getOwnerId(authKey: string): Promise<string | null> {
    // 优先从内存读取
    let ownerId = this.ownerIdMap.get(authKey);
    if (ownerId) {
      return ownerId;
    }

    // 从 KV 读取
    const cookieValue = await getMpCookie(authKey);
    if (cookieValue?.ownerId) {
      this.ownerIdMap.set(authKey, cookieValue.ownerId);
      return cookieValue.ownerId;
    }

    return null;
  }

  /**
   * 转换为 json 格式，方便存储与传输
   * 返回一个对象，键为 uuid，值为解析后的 cookie 对象
   */
  toJSON(): Record<string, AccountCookie> {
    const json: Record<string, AccountCookie> = {};
    for (const [authKey, accountCookie] of this.store) {
      json[authKey] = accountCookie;
    }
    return json;
  }
}

export const cookieStore = new CookieStore();

/**
 * 从 CookieStore 中获取 cookie 字符串
 *
 * @description 根据请求中的 X-Auth-Key header 或者 auth-key cookie，从 CookieStore 中检索用户登录信息的 cookie，这些 cookie 会透传给微信
 * @param event
 */
export async function getCookieFromStore(event: H3Event): Promise<string | null> {
  let cookie: string | null = null;

  // 优先根据自定义的 X-Auth-Key 检索
  let authKey = getRequestHeader(event, 'X-Auth-Key');
  if (authKey) {
    cookie = await cookieStore.getCookie(authKey);
    if (cookie) {
      return cookie;
    }
  }

  // 从 cookie 中的 token 检索
  const cookies = parseCookies(event);
  authKey = cookies['auth-key'];
  if (authKey) {
    cookie = await cookieStore.getCookie(authKey);
    if (cookie) {
      return cookie;
    }
  }

  return null;
}

/**
 * 从 CookieStore 中获取公众号的 token
 *
 * @description 根据请求中的 X-Auth-Key header 或者 auth-key cookie，从 CookieStore 中检索用户登录时绑定的 token
 * @param event
 */
export async function getTokenFromStore(event: H3Event): Promise<string | null> {
  let token: string | null = null;

  // 优先根据自定义的 X-Auth-Key 检索
  let authKey = getRequestHeader(event, 'X-Auth-Key');
  if (authKey) {
    token = await cookieStore.getToken(authKey);
    if (token) {
      return token;
    }
  }

  // 从 cookie 中的 token 检索
  const cookies = parseCookies(event);
  authKey = cookies['auth-key'];
  if (authKey) {
    token = await cookieStore.getToken(authKey);
    if (token) {
      return token;
    }
  }

  return null;
}

/**
 * 从请求中获取 cookie 字符串
 *
 * @description 用于登录过程中 uuid cookie 透传给微信
 * @param event
 */
export function getCookiesFromRequest(event: H3Event): string {
  const cookies = parseCookies(event);
  return Object.keys(cookies)
    .map(key => `${key}=${cookies[key]}`)
    .join(';');
}

/**
 * 从 response 中获取指定的 set-cookie 的 value 部分
 * @param name cookie 名
 * @param response
 */
export function getCookieFromResponse(name: string, response: Response): string | null {
  const cookies = AccountCookie.parse(response.headers.getSetCookie());
  const targetCookie = cookies.find(cookie => cookie.name === name);
  if (targetCookie) {
    return targetCookie.value as string;
  }
  return null;
}

/**
 * 从请求中获取 ownerId
 *
 * @description 根据请求中的 X-Owner-Id header 或通过 auth-key 从 CookieStore 中获取
 * @param event
 */
export async function getOwnerIdFromRequest(event: H3Event): Promise<string | null> {
  // 优先从 header 读取
  let ownerId = getRequestHeader(event, 'X-Owner-Id');
  if (ownerId) {
    return ownerId;
  }

  // 通过 auth-key 从 CookieStore 读取
  let authKey = getRequestHeader(event, 'X-Auth-Key');
  if (authKey) {
    ownerId = await cookieStore.getOwnerId(authKey);
    if (ownerId) {
      return ownerId;
    }
  }

  // 从 cookie 中的 auth-key 检索
  const cookies = parseCookies(event);
  authKey = cookies['auth-key'];
  if (authKey) {
    ownerId = await cookieStore.getOwnerId(authKey);
    if (ownerId) {
      return ownerId;
    }
  }

  return null;
}

