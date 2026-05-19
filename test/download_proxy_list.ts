import assert from 'node:assert/strict';
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

function run() {
  const privateProxies = ['https://example.test/proxy'];

  assert.deepEqual(resolveDownloadProxyList(privateProxies), privateProxies);

  const defaultProxies = resolveDownloadProxyList([]);
  assert.deepEqual(defaultProxies, [LOCAL_DOWNLOAD_PROXY]);

  defaultProxies.push('https://mutated.example.test');
  assert.deepEqual(resolveDownloadProxyList([]), [LOCAL_DOWNLOAD_PROXY]);

  assert.deepEqual(resolveDownloadProxyListFromLocalStorage(new MemoryStorage()), [LOCAL_DOWNLOAD_PROXY]);

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

  assert.deepEqual(resolveDownloadProxyList(['https://00.worker-proxy.asia', 'https://01.net-proxy.asia/']), [
    LOCAL_DOWNLOAD_PROXY,
  ]);

  assert.deepEqual(resolveDownloadProxyList(['https://00.worker-proxy.asia', 'https://private.example.test/proxy/']), [
    'https://private.example.test/proxy',
  ]);
}

run();
