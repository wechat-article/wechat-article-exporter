import type { RequestOptions } from '~/server/types';
import { isDev, USER_AGENT } from '../../../config';
import { logRequest, logResponse } from '../../utils/logger';
import { extractSetCookieValues } from '../../utils/set-cookie';
import { extractAuthKeyFromEvent, getCookieHeaderFromEvent, persistSession } from './auth-session';

function buildCookieHeader(name: string, value: string, expiresAt: number): string {
  return `${name}=${value}; Path=/; Expires=${new Date(expiresAt).toUTCString()}; Secure; HttpOnly; SameSite=Strict`;
}

function buildExpiredCookieHeader(name: string): string {
  return `${name}=EXPIRED; Path=/; Expires=${new Date(0).toUTCString()}; Secure; HttpOnly; SameSite=Strict`;
}

function formatLoginFailureDetails(details: Record<string, unknown>): string {
  return Object.entries(details)
    .map(([key, value]) => `${key}=${typeof value === 'string' ? value : JSON.stringify(value)}`)
    .join('; ');
}

export async function proxyMpRequest(options: RequestOptions) {
  const headers = new Headers({
    Referer: 'https://mp.weixin.qq.com/',
    Origin: 'https://mp.weixin.qq.com',
    'User-Agent': USER_AGENT,
    'Accept-Encoding': 'identity',
  });

  const cookie = options.cookie || (await getCookieHeaderFromEvent(options.event));
  if (cookie) {
    headers.set('Cookie', cookie);
  }

  const requestInit: RequestInit = {
    method: options.method,
    headers,
    redirect: options.redirect || 'follow',
  };

  const endpoint = options.query
    ? `${options.endpoint}?${new URLSearchParams(options.query as Record<string, string>).toString()}`
    : options.endpoint;

  if (options.method === 'POST' && options.body) {
    requestInit.body = new URLSearchParams(options.body as Record<string, string>).toString();
  }

  const request = new Request(endpoint, requestInit);
  const requestId = crypto.randomUUID().replace(/-/g, '');

  if (process.env.NUXT_DEBUG_MP_REQUEST && isDev) {
    await logRequest(requestId, request.clone());
  }

  const mpResponse = await fetch(request);

  if (process.env.NUXT_DEBUG_MP_REQUEST && isDev) {
    await logResponse(requestId, mpResponse.clone());
  }

  let setCookies: string[] = [];

  if (options.action === 'start_login') {
    setCookies = extractSetCookieValues(mpResponse.headers).filter(cookieValue => cookieValue.startsWith('uuid='));
  } else if (options.action === 'login') {
    try {
      const authKey = crypto.randomUUID().replace(/-/g, '');
      const body = await mpResponse.clone().json();
      const redirectUrl = body?.redirect_url;
      if (!redirectUrl || typeof redirectUrl !== 'string') {
        throw new Error(`登录响应中未找到 redirect_url，响应内容: ${JSON.stringify(body)}`);
      }

      const token = new URL(`http://localhost${redirectUrl}`).searchParams.get('token');
      if (!token) {
        throw new Error(`redirect_url 中未找到 token 参数: ${redirectUrl}`);
      }

      const upstreamSetCookies = extractSetCookieValues(mpResponse.headers);
      const nativeCount = mpResponse.headers.getSetCookie?.().length ?? -1;
      console.info(
        `[login] wx.status=${mpResponse.status} native=${nativeCount} extracted=${upstreamSetCookies.length} runtime=${process.env.NITRO_PRESET || 'node-server'}`,
      );
      if (upstreamSetCookies.length === 0) {
        throw new Error(
          formatLoginFailureDetails({
            reason: '上游登录响应未暴露 set-cookie',
            runtime: process.env.NITRO_PRESET || 'node-server',
            status: mpResponse.status,
            redirectUrlFound: true,
            hint: 'Cloudflare Pages/Workers 环境可能无法读取微信登录返回的 set-cookie，请优先使用 Node/Docker 部署验证',
          })
        );
      }

      const session = await persistSession(authKey, token, upstreamSetCookies);
      if (!session || !session.expiresAt) {
        throw new Error(
          formatLoginFailureDetails({
            reason: 'cookie 写入 KV 存储失败',
            runtime: process.env.NITRO_PRESET || 'node-server',
            status: mpResponse.status,
            upstreamSetCookieCount: upstreamSetCookies.length,
          })
        );
      }

      setCookies = [buildCookieHeader('auth-key', authKey, session.expiresAt), buildExpiredCookieHeader('uuid')];
    } catch (error) {
      console.error('action(login) failed:', error);
      return new Response(JSON.stringify({ base_resp: { ret: -1, err_msg: `登录处理失败: ${error}` } }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  } else if (options.action === 'switch_account') {
    if (extractAuthKeyFromEvent(options.event)) {
      setCookies = ['switch_account=1'];
    }
  }

  const responseHeaders = new Headers(mpResponse.headers);
  responseHeaders.delete('set-cookie');
  setCookies.forEach(setCookie => {
    responseHeaders.append('set-cookie', setCookie);
  });

  const finalResponse = new Response(mpResponse.body, {
    status: mpResponse.status,
    statusText: mpResponse.statusText,
    headers: responseHeaders,
  });

  if (!options.parseJson) {
    return finalResponse;
  }

  return finalResponse.json();
}
