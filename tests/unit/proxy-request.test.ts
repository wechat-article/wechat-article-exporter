import { afterEach, describe, expect, it, vi } from 'vitest';
import { proxyMpRequest } from '~/server/utils/proxy-request';

describe('proxy-request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not forward blocked endpoints', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = (await proxyMpRequest({
      event: {} as any,
      method: 'GET',
      endpoint: 'https://example.com/cgi-bin/searchbiz',
      parseJson: false,
    })) as Response;

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      base_resp: {
        ret: -1,
        err_msg: '不允许的微信代理 endpoint',
      },
      proxy_error: {
        code: 'MP_PROXY_ENDPOINT_BLOCKED',
        retryable: false,
        reason: 'UNSUPPORTED_HOST',
      },
    });
  });

  it('returns a blocked body directly for parsed-json callers', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const result = await proxyMpRequest({
      event: {} as any,
      method: 'GET',
      endpoint: 'https://mp.weixin.qq.com/cgi-bin/not-allowed',
      parseJson: true,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
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
