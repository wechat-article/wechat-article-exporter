import { MP_ORIGIN } from '~/server/wechat/endpoints';

export const WECHAT_MP_HOST = 'mp.weixin.qq.com';
export const WECHAT_ACCOUNT_NAME_HOSTS = [WECHAT_MP_HOST, 'weixin.qq.com'] as const;
export const WECHAT_ARTICLE_PATH_PREFIXES = ['/s'] as const;
export const WECHAT_ABOUT_BIZ_ENDPOINT = `${MP_ORIGIN}/mp/aboutbiz`;

export type WechatDirectFetchQuery = Record<string, string | number | undefined>;

export type WechatDirectFetchRejectionReason =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'UNSUPPORTED_HOST'
  | 'UNSUPPORTED_PORT'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'UNSUPPORTED_PATH';

export type WechatDirectFetchResult =
  | {
      allowed: true;
      url: string;
      hostname: string;
      pathname: string;
    }
  | {
      allowed: false;
      reason: WechatDirectFetchRejectionReason;
    };

export interface WechatDirectFetchOptions {
  allowedHosts?: readonly string[];
  allowedPathPrefixes?: readonly string[];
  query?: WechatDirectFetchQuery;
}

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`);
}

export function buildAllowedWechatDirectFetchUrl(
  rawUrl: string,
  options: WechatDirectFetchOptions = {},
): WechatDirectFetchResult {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'UNSUPPORTED_PROTOCOL' };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'CREDENTIALS_NOT_ALLOWED' };
  }

  if (parsed.port) {
    return { allowed: false, reason: 'UNSUPPORTED_PORT' };
  }

  const allowedHosts = options.allowedHosts ?? [WECHAT_MP_HOST];
  if (!allowedHosts.includes(parsed.hostname)) {
    return { allowed: false, reason: 'UNSUPPORTED_HOST' };
  }

  if (options.allowedPathPrefixes?.length) {
    const pathAllowed = options.allowedPathPrefixes.some(prefix => pathMatchesPrefix(parsed.pathname, prefix));
    if (!pathAllowed) {
      return { allowed: false, reason: 'UNSUPPORTED_PATH' };
    }
  }

  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined) {
      parsed.searchParams.set(key, String(value));
    }
  }

  return {
    allowed: true,
    url: parsed.toString(),
    hostname: parsed.hostname,
    pathname: parsed.pathname,
  };
}

export function createWechatDirectFetchBlockedBody(reason: WechatDirectFetchRejectionReason) {
  return {
    base_resp: {
      ret: -1,
      err_msg: '不允许的微信直连 URL',
    },
    fetch_error: {
      code: 'WECHAT_DIRECT_FETCH_BLOCKED',
      retryable: false,
      reason,
    },
  };
}

export function createWechatDirectFetchRequestInit(headers: HeadersInit): RequestInit {
  return {
    headers,
    redirect: 'error',
  };
}

export function toSafeWechatDebugFileSegment(value: string): string {
  const safeValue = value.replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 128);
  return safeValue || 'unknown';
}
