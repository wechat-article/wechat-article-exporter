import { describe, expect, it } from 'vitest';
import {
  buildAllowedMpProxyUrl,
  createMpProxyEndpointBlockedBody,
  MP_PROXY_ALLOWED_PATHS,
} from '~/server/utils/mp-proxy-allowlist';
import { MP_ENDPOINTS } from '~/server/wechat/endpoints';

describe('mp-proxy-allowlist', () => {
  it('allows every centralized WeChat proxy endpoint path', () => {
    for (const endpoint of Object.values(MP_ENDPOINTS)) {
      const result = buildAllowedMpProxyUrl(endpoint);
      expect(result).toMatchObject({ allowed: true });
    }
  });

  it('contains the current literal proxy paths used by routes', () => {
    expect(MP_PROXY_ALLOWED_PATHS.has('/cgi-bin/home')).toBe(true);
    expect(MP_PROXY_ALLOWED_PATHS.has('/mp/authorinfo')).toBe(true);
    expect(MP_PROXY_ALLOWED_PATHS.has('/mp/appmsg_comment')).toBe(true);
    expect(MP_PROXY_ALLOWED_PATHS.has('/mp/appmsgalbum')).toBe(true);
  });

  it('appends query params after endpoint validation', () => {
    const result = buildAllowedMpProxyUrl(MP_ENDPOINTS.searchbiz, {
      action: 'search_biz',
      begin: 0,
      query: '公众号',
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) {
      return;
    }

    const url = new URL(result.url);
    expect(url.origin).toBe('https://mp.weixin.qq.com');
    expect(url.pathname).toBe('/cgi-bin/searchbiz');
    expect(url.searchParams.get('action')).toBe('search_biz');
    expect(url.searchParams.get('begin')).toBe('0');
    expect(url.searchParams.get('query')).toBe('公众号');
  });

  it('rejects non-WeChat or non-HTTPS endpoints', () => {
    expect(buildAllowedMpProxyUrl('http://mp.weixin.qq.com/cgi-bin/searchbiz')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_PROTOCOL',
    });
    expect(buildAllowedMpProxyUrl('https://example.com/cgi-bin/searchbiz')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_HOST',
    });
    expect(buildAllowedMpProxyUrl('https://mp.weixin.qq.com.evil.test/cgi-bin/searchbiz')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_HOST',
    });
  });

  it('rejects credentials, custom ports, unsupported paths, and invalid urls', () => {
    expect(buildAllowedMpProxyUrl('https://user:pass@mp.weixin.qq.com/cgi-bin/searchbiz')).toEqual({
      allowed: false,
      reason: 'CREDENTIALS_NOT_ALLOWED',
    });
    expect(buildAllowedMpProxyUrl('https://mp.weixin.qq.com:444/cgi-bin/searchbiz')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_PORT',
    });
    expect(buildAllowedMpProxyUrl('https://mp.weixin.qq.com/cgi-bin/not-allowed')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_PATH',
    });
    expect(buildAllowedMpProxyUrl('not a url')).toEqual({
      allowed: false,
      reason: 'INVALID_URL',
    });
  });

  it('returns a stable blocked response body', () => {
    expect(createMpProxyEndpointBlockedBody('UNSUPPORTED_PATH')).toEqual({
      base_resp: {
        ret: -1,
        err_msg: '不允许的微信代理 endpoint',
      },
      proxy_error: {
        code: 'MP_PROXY_ENDPOINT_BLOCKED',
        retryable: false,
        reason: 'UNSUPPORTED_PATH',
      },
    });
  });
});
