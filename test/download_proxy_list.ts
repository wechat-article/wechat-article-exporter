import assert from 'node:assert/strict';
import { PUBLIC_PROXY_LIST } from '../config/public-proxy';
import {
  LOCAL_DOWNLOAD_PROXY,
  resolveDownloadProxyList,
  resolveDownloadProxyListFromLocalStorage,
} from '../utils/download/proxy-list';

class MemoryStorage {
  private readonly values = new Map<string, string>();

  constructor(values: Record<string, string> = {}) {
    for (const [key, value] of Object.entries(values)) {
      this.values.set(key, value);
    }
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
}

function withBrowserContext<T>(callback: () => T): T {
  const originalWindow = globalThis.window;

  try {
    (globalThis as unknown as { window: { location: { protocol: string } } }).window = {
      location: {
        protocol: 'http:',
      },
    };

    return callback();
  } finally {
    if (originalWindow === undefined) {
      delete (globalThis as unknown as { window?: unknown }).window;
    } else {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  }
}

function run() {
  const privateProxies = ['https://example.test/proxy'];

  // Private proxies always take priority
  assert.deepEqual(resolveDownloadProxyList(privateProxies), privateProxies);

  // In Node context (no window), no private proxies → PUBLIC_PROXY_LIST as fallback
  assert.deepEqual(resolveDownloadProxyList([]), PUBLIC_PROXY_LIST);

  // No mutation of return value
  const defaultProxies = resolveDownloadProxyList([]);
  defaultProxies.push('https://mutated.example.test');
  assert.deepEqual(resolveDownloadProxyList([]), PUBLIC_PROXY_LIST);

  // Empty localStorage → PUBLIC_PROXY_LIST (Node context)
  assert.deepEqual(resolveDownloadProxyListFromLocalStorage(new MemoryStorage()), PUBLIC_PROXY_LIST);

  withBrowserContext(() => {
    assert.deepEqual(resolveDownloadProxyList([]), [LOCAL_DOWNLOAD_PROXY]);
    assert.deepEqual(resolveDownloadProxyList(PUBLIC_PROXY_LIST), [LOCAL_DOWNLOAD_PROXY]);
    assert.deepEqual(resolveDownloadProxyList(PUBLIC_PROXY_LIST.slice(0, 2)), [LOCAL_DOWNLOAD_PROXY]);
    assert.deepEqual(resolveDownloadProxyList([PUBLIC_PROXY_LIST[0], 'https://private.example.test']), [
      'https://private.example.test',
    ]);

    assert.deepEqual(
      resolveDownloadProxyListFromLocalStorage(
        new MemoryStorage({
          preferences: JSON.stringify({
            privateProxyList: PUBLIC_PROXY_LIST,
          }),
        })
      ),
      [LOCAL_DOWNLOAD_PROXY]
    );

    assert.deepEqual(
      resolveDownloadProxyListFromLocalStorage(
        new MemoryStorage({
          'wechat-proxy': JSON.stringify(PUBLIC_PROXY_LIST),
        })
      ),
      [LOCAL_DOWNLOAD_PROXY]
    );
  });

  // preferences with privateProxyList → those proxies (trimmed)
  assert.deepEqual(
    resolveDownloadProxyListFromLocalStorage(
      new MemoryStorage({
        preferences: JSON.stringify({
          privateProxyList: ['https://private.example.test/', '  https://second.example.test  '],
        }),
      })
    ),
    ['https://private.example.test', 'https://second.example.test']
  );

  // Legacy wechat-proxy key
  assert.deepEqual(
    resolveDownloadProxyListFromLocalStorage(
      new MemoryStorage({
        'wechat-proxy': JSON.stringify(['https://legacy.example.test']),
      })
    ),
    ['https://legacy.example.test']
  );
}

run();
