import { H3Event, parseCookies } from 'h3';
import { readFileSync, writeFileSync } from 'node:fs';
import fs from 'node:fs';
import path from 'node:path';
import { root } from '~/server/config';

// 表示一条 set-cookie 记录的解析结果
type TCookie = Record<string, string | number>;

// 公众号对应的 cookie 对象 (已解析)
export class AccountCookie {
  private readonly _cookie: TCookie[];

  constructor(cookies: string[]) {
    this._cookie = this.parse(cookies);
  }

  public toString(): string {
    return this.stringify(this._cookie);
  }

  public toJSON(): TCookie[] {
    return this._cookie;
  }

  public get(name: string): TCookie | undefined {
    return this._cookie.find(cookie => cookie.name === name);
  }

  // 根据 cookie 中的 expires 来确定是否已过期
  public get isExpired(): boolean {
    // todo
    return false;
  }

  private parse(cookies: string[]): TCookie[] {
    // Use a Map to store cookies by name, ensuring the last occurrence overwrites duplicates
    const cookieMap = new Map<string, TCookie>();

    for (const cookie of cookies) {
      const cookieObj: TCookie = {};
      // 分割cookie字符串为各个属性
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

    // Convert Map values to array
    return Array.from(cookieMap.values());
  }

  private stringify(parsedCookie: TCookie[]): string {
    return parsedCookie
      .filter(cookie => cookie.value && cookie.value !== 'EXPIRED')
      .map(cookie => `${cookie.name}=${cookie.value}`)
      .join('; ');
  }
}

// 所有用户的 cookie 仓库
class CookieStore {
  store!: Map<string, AccountCookie>;
  private readonly cookieDumpFilePath: string;

  token!: Map<string, string>;
  private readonly tokenDumpFilePath: string;

  constructor() {
    this.cookieDumpFilePath = path.resolve(root, '.data/cookies.json');
    this.tokenDumpFilePath = path.resolve(root, '.data/tokens.json');

    this.load();
  }

  /**
   * 检索用户的cookie
   * @param authKey
   * @return 适合作为请求头的Cookie字符串
   */
  getCookie(authKey: string): string | null {
    const cookieObj = this.store.get(authKey);
    if (cookieObj) {
      return cookieObj.toString();
    }
    return null;
  }

  /**
   * 存储用户的cookie
   * @param authKey
   * @param cookie 原始的 set-cookie 字符串数组
   */
  setCookie(authKey: string, cookie: string[]) {
    this.store.set(authKey, new AccountCookie(cookie));
    this.dumpCookies();
  }

  /**
   * 更新用户的cookie，保留旧cookie并更新新cookie
   * @param authKey
   * @param newCookies 新的 set-cookie 字符串数组
   */
  updateCookie(authKey: string, newCookies: string[]) {
    // Parse new cookies
    const newAccountCookie = new AccountCookie(newCookies);
    const newCookieMap = new Map<string, TCookie>(
      newAccountCookie.toJSON().map(cookie => [cookie.name as string, cookie])
    );

    // Get existing cookies, if any
    const existingCookieObj = this.store.get(authKey);
    let mergedCookies: TCookie[] = [];

    if (existingCookieObj) {
      // Merge existing cookies with new ones, new cookies override duplicates
      const existingCookies = existingCookieObj.toJSON();
      const existingCookieMap = new Map<string, TCookie>(
        existingCookies.map(cookie => [cookie.name as string, cookie])
      );

      // Keep all existing cookies, overwrite with new ones if they exist
      mergedCookies = Array.from(existingCookieMap.entries()).reduce<TCookie[]>((acc, [name, cookie]) => {
        if (newCookieMap.has(name)) {
          // Use new cookie if it exists
          acc.push(newCookieMap.get(name)!);
          newCookieMap.delete(name); // Remove used new cookie
        } else {
          // Keep existing cookie
          acc.push(cookie);
        }
        return acc;
      }, []);

      // Add any remaining new cookies that weren't duplicates
      mergedCookies.push(...Array.from(newCookieMap.values()));
    } else {
      // No existing cookies, use new cookies as is
      mergedCookies = newAccountCookie.toJSON();
    }

    // Convert merged cookies back to string array for AccountCookie constructor
    const mergedCookieStrings = mergedCookies.map(cookie => {
      const parts = [`${cookie.name}=${cookie.value}`];
      for (const [key, value] of Object.entries(cookie)) {
        if (key !== 'name' && key !== 'value' && key !== 'expires_timestamp') {
          parts.push(value === 'true' ? key : `${key}=${value}`);
        }
      }
      return parts.join('; ');
    });

    // Update store with merged cookies
    this.store.set(authKey, new AccountCookie(mergedCookieStrings));
    this.dumpCookies();
  }

  /**
   * 检索用户的 token
   * @param authKey
   */
  getToken(authKey: string): string | null {
    return this.token.get(authKey) || null;
  }

  /**
   * 绑定 token
   * @param authKey
   * @param token
   */
  bindToken(authKey: string, token: string) {
    this.token.set(authKey, token);
    this.dumpTokens();
  }

  /**
   * 转换为 json 格式，方便存储与传输
   * 返回一个对象，键为 uuid，值为解析后的 cookie 对象
   */
  toJSON(): Record<string, TCookie[]> {
    const json: Record<string, TCookie[]> = {};
    for (const [authKey, cookieObj] of this.store) {
      json[authKey] = cookieObj.toJSON();
    }
    return json;
  }

  // 从文件中加载
  load(): void {
    this.loadCookies();
    this.loadTokens();
  }

  loadCookies() {
    this.store = new Map<string, AccountCookie>();

    try {
      if (!fs.existsSync(this.cookieDumpFilePath)) {
        return;
      }

      const data = readFileSync(this.cookieDumpFilePath, 'utf-8');
      const json = JSON.parse(data) as Record<string, TCookie[]>;
      for (const [authKey, cookies] of Object.entries(json)) {
        // Reconstruct cookie strings from parsed objects
        const cookieStrings = cookies.map(cookie => {
          const parts = [`${cookie.name}=${cookie.value}`];
          for (const [key, value] of Object.entries(cookie)) {
            if (key !== 'name' && key !== 'value' && key !== 'expires_timestamp') {
              parts.push(value === 'true' ? key : `${key}=${value}`);
            }
          }
          return parts.join('; ');
        });
        this.store.set(authKey, new AccountCookie(cookieStrings));
      }
    } catch (error) {
      console.error('Failed to load cookie store:', error);
    }
  }

  loadTokens() {
    this.token = new Map<string, string>();

    try {
      if (!fs.existsSync(this.tokenDumpFilePath)) {
        return;
      }

      const data = readFileSync(this.tokenDumpFilePath, 'utf-8');
      const json = JSON.parse(data) as Record<string, string>;
      for (const [authKey, token] of Object.entries(json)) {
        this.token.set(authKey, token);
      }
    } catch (error) {
      console.error('Failed to load token store:', error);
    }
  }

  dumpCookies() {
    try {
      const json = JSON.stringify(this.toJSON(), null, 2);
      writeFileSync(this.cookieDumpFilePath, json, 'utf-8');
    } catch (error) {
      console.error('Failed to save cookie store:', error);
    }
  }

  dumpTokens() {
    try {
      const json = JSON.stringify(Object.fromEntries(this.token), null, 2);
      writeFileSync(this.tokenDumpFilePath, json, 'utf-8');
    } catch (error) {
      console.error('Failed to save token store:', error);
    }
  }
}

export const cookieStore = new CookieStore();

/**
 * 从 CookieStore 中获取 cookie 字符串
 *
 * @description 根据请求中的 X-Auth-Key header 或者 auth-key cookie，从 CookieStore 中检索用户登录信息的 cookie，这些 cookie 会透传给微信
 * @param event
 */
export function getCookieFromStore(event: H3Event): string | null {
  let cookie: string | null = null;

  // 优先根据自定义的 X-Auth-Key 检索
  let authKey = getRequestHeader(event, 'X-Auth-Key');
  if (authKey) {
    cookie = cookieStore.getCookie(authKey);
    if (cookie) {
      return cookie;
    }
  }

  // 从 cookie 中的 token 检索
  const cookies = parseCookies(event);
  authKey = cookies['auth-key'];
  if (authKey) {
    cookie = cookieStore.getCookie(authKey);
    if (cookie) {
      return cookie;
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
export function getCookieFromRequest(event: H3Event): string {
  const cookies = parseCookies(event);
  return Object.keys(cookies)
    .map(key => `${key}=${cookies[key]}`)
    .join(';');
}

/**
 * 从 CookieStore 中获取公众号的 token
 *
 * @description 根据请求中的 X-Auth-Key header 或者 auth-key cookie，从 CookieStore 中检索用户登录时绑定的 token
 * @param event
 */
export function getTokenFromStore(event: H3Event): string | null {
  let token: string | null = null;

  // 优先根据自定义的 X-Auth-Key 检索
  let authKey = getRequestHeader(event, 'X-Auth-Key');
  if (authKey) {
    token = cookieStore.getToken(authKey);
    if (token) {
      return token;
    }
  }

  // 从 cookie 中的 token 检索
  const cookies = parseCookies(event);
  authKey = cookies['auth-key'];
  if (authKey) {
    token = cookieStore.getToken(authKey);
    if (token) {
      return token;
    }
  }

  return null;
}
