import { describe, expect, it, vi } from 'vitest';
import { runResourceFetchTask, type ResourceFetchState } from '~/utils/download/exporter/resourceFetcher';
import type { ResourceAsset } from '~/store/v2/resource';

function createState(): ResourceFetchState {
  return {
    pending: new Set(),
    completed: new Set(),
    failed: new Set(),
  };
}

function createProxyManager(proxies: string[] = ['proxy-a']) {
  const used: string[] = [];
  const successes: string[] = [];
  return {
    used,
    successes,
    manager: {
      getBestProxy: () => {
        const proxy = proxies[Math.min(used.length, proxies.length - 1)];
        used.push(proxy);
        return proxy;
      },
      recordSuccess: (proxy: string) => {
        successes.push(proxy);
      },
    },
  };
}

describe('runResourceFetchTask', () => {
  it('marks cached resources as completed without downloading', async () => {
    const state = createState();
    const proxy = createProxyManager();
    const download = vi.fn();

    const result = await runResourceFetchTask({
      url: 'https://cdn.example.com/a.png',
      fakeid: 'fakeid-1',
      maxRetries: 2,
      state,
      proxyManager: proxy.manager,
      download,
      handleDownloadFailure: vi.fn(),
      getCachedResource: async url =>
        ({
          fakeid: 'fakeid-1',
          url,
          file: new Blob(['cached']),
        }) satisfies ResourceAsset,
      updateCachedResource: vi.fn(),
    });

    expect(result).toEqual({
      status: 'cached',
      attempts: 0,
    });
    expect(download).not.toHaveBeenCalled();
    expect(state.pending.has('https://cdn.example.com/a.png')).toBe(false);
    expect(state.completed.has('https://cdn.example.com/a.png')).toBe(true);
    expect(state.failed.has('https://cdn.example.com/a.png')).toBe(false);
    expect(proxy.used).toHaveLength(0);
  });

  it('records success after a retry and caches the downloaded blob', async () => {
    const state = createState();
    const proxy = createProxyManager(['proxy-a', 'proxy-b']);
    const file = new Blob(['downloaded']);
    const updateCachedResource = vi.fn();
    const handleDownloadFailure = vi.fn();
    const download = vi.fn().mockRejectedValueOnce(new Error('transient')).mockResolvedValueOnce(file);

    const result = await runResourceFetchTask({
      url: 'https://cdn.example.com/a.png',
      fakeid: 'fakeid-1',
      maxRetries: 2,
      state,
      proxyManager: proxy.manager,
      download,
      handleDownloadFailure,
      getCachedResource: async () => undefined,
      updateCachedResource,
    });

    expect(result).toEqual({
      status: 'downloaded',
      attempts: 2,
      proxy: 'proxy-b',
    });
    expect(handleDownloadFailure).toHaveBeenCalledWith('proxy-a', 'https://cdn.example.com/a.png', 0, expect.any(Error));
    expect(updateCachedResource).toHaveBeenCalledWith({
      fakeid: 'fakeid-1',
      url: 'https://cdn.example.com/a.png',
      file,
    });
    expect(proxy.successes).toEqual(['proxy-b']);
    expect(state.pending.has('https://cdn.example.com/a.png')).toBe(false);
    expect(state.completed.has('https://cdn.example.com/a.png')).toBe(true);
    expect(state.failed.has('https://cdn.example.com/a.png')).toBe(false);
  });

  it('marks resources as failed after exhausting retries', async () => {
    const state = createState();
    const proxy = createProxyManager(['proxy-a', 'proxy-b']);
    const handleDownloadFailure = vi.fn();

    const result = await runResourceFetchTask({
      url: 'https://cdn.example.com/a.png',
      fakeid: 'fakeid-1',
      maxRetries: 2,
      state,
      proxyManager: proxy.manager,
      download: vi.fn().mockRejectedValue(new Error('unavailable')),
      handleDownloadFailure,
      getCachedResource: async () => undefined,
      updateCachedResource: vi.fn(),
    });

    expect(result).toEqual({
      status: 'failed',
      attempts: 2,
    });
    expect(handleDownloadFailure).toHaveBeenCalledTimes(2);
    expect(proxy.successes).toHaveLength(0);
    expect(state.pending.has('https://cdn.example.com/a.png')).toBe(false);
    expect(state.completed.has('https://cdn.example.com/a.png')).toBe(false);
    expect(state.failed.has('https://cdn.example.com/a.png')).toBe(true);
  });
});
