import { MP_ENDPOINTS } from '~/server/wechat/endpoints';

export type MpProxyQuery = Record<string, string | number | undefined>;

export type MpProxyEndpointRejectionReason =
  | 'INVALID_URL'
  | 'UNSUPPORTED_PROTOCOL'
  | 'UNSUPPORTED_HOST'
  | 'UNSUPPORTED_PORT'
  | 'CREDENTIALS_NOT_ALLOWED'
  | 'UNSUPPORTED_PATH';

export type MpProxyEndpointResult =
  | {
      allowed: true;
      url: string;
      pathname: string;
    }
  | {
      allowed: false;
      reason: MpProxyEndpointRejectionReason;
    };

export const MP_PROXY_ALLOWED_PATHS = new Set(Object.values(MP_ENDPOINTS).map(endpoint => new URL(endpoint).pathname));

export function buildAllowedMpProxyUrl(endpoint: string, query?: MpProxyQuery): MpProxyEndpointResult {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    return { allowed: false, reason: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'https:') {
    return { allowed: false, reason: 'UNSUPPORTED_PROTOCOL' };
  }

  if (parsed.hostname !== 'mp.weixin.qq.com') {
    return { allowed: false, reason: 'UNSUPPORTED_HOST' };
  }

  if (parsed.port) {
    return { allowed: false, reason: 'UNSUPPORTED_PORT' };
  }

  if (parsed.username || parsed.password) {
    return { allowed: false, reason: 'CREDENTIALS_NOT_ALLOWED' };
  }

  if (!MP_PROXY_ALLOWED_PATHS.has(parsed.pathname)) {
    return { allowed: false, reason: 'UNSUPPORTED_PATH' };
  }

  if (query) {
    const queryString = new URLSearchParams(query as Record<string, string>).toString();
    if (queryString) {
      parsed.search = parsed.search ? `${parsed.search}&${queryString}` : queryString;
    }
  }

  return {
    allowed: true,
    url: parsed.toString(),
    pathname: parsed.pathname,
  };
}

export function createMpProxyEndpointBlockedBody(reason: MpProxyEndpointRejectionReason) {
  return {
    base_resp: {
      ret: -1,
      err_msg: '不允许的微信代理 endpoint',
    },
    proxy_error: {
      code: 'MP_PROXY_ENDPOINT_BLOCKED',
      retryable: false,
      reason,
    },
  };
}
