import { describe, expect, it } from 'vitest';
import {
  buildAllowedWechatDirectFetchUrl,
  createWechatDirectFetchBlockedBody,
  createWechatDirectFetchRequestInit,
  toSafeWechatDebugFileSegment,
  WECHAT_ACCOUNT_NAME_HOSTS,
  WECHAT_ARTICLE_PATH_PREFIXES,
  WECHAT_MP_HOST,
} from '~/server/utils/wechat-direct-fetch';

describe('wechat-direct-fetch', () => {
  it('allows article URLs on the expected WeChat article paths', () => {
    const queryArticle = buildAllowedWechatDirectFetchUrl('https://mp.weixin.qq.com/s?__biz=abc', {
      allowedHosts: [WECHAT_MP_HOST],
      allowedPathPrefixes: WECHAT_ARTICLE_PATH_PREFIXES,
    });
    const pathArticle = buildAllowedWechatDirectFetchUrl('https://mp.weixin.qq.com/s/example-token', {
      allowedHosts: [WECHAT_MP_HOST],
      allowedPathPrefixes: WECHAT_ARTICLE_PATH_PREFIXES,
    });

    expect(queryArticle).toMatchObject({ allowed: true, pathname: '/s' });
    expect(pathArticle).toMatchObject({ allowed: true, pathname: '/s/example-token' });
  });

  it('rejects article download URLs outside the article path', () => {
    expect(
      buildAllowedWechatDirectFetchUrl('https://mp.weixin.qq.com/mp/aboutbiz?__biz=abc', {
        allowedHosts: [WECHAT_MP_HOST],
        allowedPathPrefixes: WECHAT_ARTICLE_PATH_PREFIXES,
      }),
    ).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_PATH',
    });
  });

  it('allows account-name lookup hosts while keeping URL transport restrictions', () => {
    expect(
      buildAllowedWechatDirectFetchUrl('https://weixin.qq.com/some/path', {
        allowedHosts: WECHAT_ACCOUNT_NAME_HOSTS,
      }),
    ).toMatchObject({ allowed: true, hostname: 'weixin.qq.com' });
  });

  it('rejects unsupported transport, host, port, credentials, and invalid URLs', () => {
    expect(buildAllowedWechatDirectFetchUrl('http://mp.weixin.qq.com/s/abc')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_PROTOCOL',
    });
    expect(buildAllowedWechatDirectFetchUrl('https://example.com/s/abc')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_HOST',
    });
    expect(buildAllowedWechatDirectFetchUrl('https://mp.weixin.qq.com:444/s/abc')).toEqual({
      allowed: false,
      reason: 'UNSUPPORTED_PORT',
    });
    expect(buildAllowedWechatDirectFetchUrl('https://user:pass@mp.weixin.qq.com/s/abc')).toEqual({
      allowed: false,
      reason: 'CREDENTIALS_NOT_ALLOWED',
    });
    expect(buildAllowedWechatDirectFetchUrl('not a url')).toEqual({
      allowed: false,
      reason: 'INVALID_URL',
    });
  });

  it('appends direct-fetch query params safely', () => {
    const result = buildAllowedWechatDirectFetchUrl('https://mp.weixin.qq.com/mp/aboutbiz', {
      query: {
        __biz: 'abc',
        wx_header: '',
      },
    });

    expect(result.allowed).toBe(true);
    if (!result.allowed) {
      return;
    }

    const url = new URL(result.url);
    expect(url.searchParams.get('__biz')).toBe('abc');
    expect(url.searchParams.get('wx_header')).toBe('');
  });

  it('returns stable blocked bodies and no-follow request init', () => {
    expect(createWechatDirectFetchBlockedBody('UNSUPPORTED_HOST')).toEqual({
      base_resp: {
        ret: -1,
        err_msg: '不允许的微信直连 URL',
      },
      fetch_error: {
        code: 'WECHAT_DIRECT_FETCH_BLOCKED',
        retryable: false,
        reason: 'UNSUPPORTED_HOST',
      },
    });
    expect(createWechatDirectFetchRequestInit({ 'User-Agent': 'ua' })).toEqual({
      headers: { 'User-Agent': 'ua' },
      redirect: 'error',
    });
  });

  it('sanitizes dev sample filename segments', () => {
    expect(toSafeWechatDebugFileSegment('../Mzg3OTYzMDkzMg==')).toBe('___Mzg3OTYzMDkzMg__');
    expect(toSafeWechatDebugFileSegment('')).toBe('unknown');
  });
});
