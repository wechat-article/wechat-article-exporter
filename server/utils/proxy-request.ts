import { v4 as uuidv4 } from 'uuid';
import { cookieStore, getCookieFromStore } from '~/server/utils/CookieStore';
import { RequestOptions } from '~/server/types';
import { logRequest, logResponse } from '~/server/utils/logger';
import { USER_AGENT } from '~/config';
import dayjs from 'dayjs';
import { H3Event, parseCookies } from 'h3';

/**
 * 转发微信公众号请求
 * @description 备注：只有登录请求(`action=login`)中的 `set-cookie` 才会被写入到 CookieStore 中
 * @param options 请求参数
 */
export async function proxyMpRequest(options: RequestOptions) {
  const runtimeConfig = useRuntimeConfig();

  const headers = new Headers({
    Referer: 'https://mp.weixin.qq.com/',
    Origin: 'https://mp.weixin.qq.com',
    'User-Agent': USER_AGENT,
  });

  // 优先读取参数中的 cookie，若无则从 CookieStore 中读取
  const cookie: string | null = options.cookie || getCookieFromStore(options.event);
  if (cookie) {
    headers.set('Cookie', cookie);
  }

  const requestInit: RequestInit = {
    method: options.method,
    headers: headers,
    redirect: options.redirect || 'follow',
  };

  // 处理参数
  if (options.query) {
    options.endpoint += '?' + new URLSearchParams(options.query as Record<string, string>).toString();
  }
  let requestBody = '';
  if (options.method === 'POST' && options.body) {
    requestBody = new URLSearchParams(options.body as Record<string, string>).toString();
    requestInit.body = requestBody;
  }

  // 构造请求
  const request = new Request(options.endpoint, requestInit);

  // 记录请求报文
  const requestId = uuidv4().replace(/-/g, '');
  if (runtimeConfig.debugMpRequest) {
    await logRequest(requestId, request.clone());
  }

  // 转发请求
  const response = await fetch(request);
  // 更新 CookieStore 中的 cookie
  updateCookies(options.event, response.headers.getSetCookie());

  // 记录响应报文
  if (runtimeConfig.debugMpRequest) {
    await logResponse(requestId, response.clone());
  }

  let setCookies: string[] = [];

  // 处理登录请求的 uuid cookie
  if (options.action === 'start_login') {
    // 提取出 uuid 这个 cookie
    setCookies = response.headers.getSetCookie().filter(cookie => cookie.startsWith('uuid='));
  }

  // 处理登录成功请求的 cookie
  // 只有登录请求才会将 Cookie 数据写入 CookieStore
  // 返回给客户端的一个 auth-key 的 cookie
  if (options.action === 'login') {
    const authKey = crypto.randomUUID().replace(/-/g, '');
    cookieStore.setCookie(authKey, response.headers.getSetCookie());

    setCookies = [
      `auth-key=${authKey}; Path=/; Expires=${dayjs().add(4, 'days').toString()}; Secure; HttpOnly`,

      // 登录成功后，删除浏览器的 uuid cookie
      `uuid=EXPIRED; Path=/; Expires=${dayjs().subtract(1, 'days').toString()}; Secure; HttpOnly`,
    ];
  }

  // 处理切换公众号的请求
  if (options.action === 'switch_account') {
    const authKey = getAuthKey(options.event);
    if (authKey) {
      setCookies = ['switch_account=1'];
    }
  }

  // 构造返回给客户端的响应
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('set-cookie');
  setCookies.forEach(setCookie => {
    responseHeaders.append('set-cookie', setCookie);
  });

  const finalResponse = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });

  if (!options.parseJson) {
    return finalResponse;
  } else {
    return finalResponse.json();
  }
}

export function getAuthKey(event: H3Event): string {
  let authKey = getRequestHeader(event, 'X-Auth-Key');
  if (!authKey) {
    const cookies = parseCookies(event);
    authKey = cookies['auth-key'];
  }

  return authKey;
}

function updateCookies(event: H3Event, cookies: string[]): void {
  const authKey = getAuthKey(event);
  if (authKey) {
    cookieStore.updateCookie(authKey, cookies);
  }
}

export async function proxyNormalRequest(options: RequestOptions) {
  const headers = new Headers({
    'User-Agent': USER_AGENT,
  });

  // 读取参数中的 cookie
  const cookie: string | undefined = options.cookie;
  if (cookie) {
    headers.set('Cookie', cookie);
  }

  const requestInit: RequestInit = {
    method: options.method,
    headers: headers,
    redirect: options.redirect || 'follow',
  };
}
