export const LOCAL_DOWNLOAD_PROXY = '/api/web/proxy/download';

const LEGACY_PUBLIC_PROXY_DOMAINS = new Set([
  'worker-proxy.asia',
  'net-proxy.asia',
  '1235566.space',
  'worker-proxy.shop',
  'worker-proxys.cyou',
  'worker-proxy.cyou',
]);

function isLegacyPublicProxy(proxy: string): boolean {
  try {
    const { hostname } = new URL(proxy);
    return Array.from(LEGACY_PUBLIC_PROXY_DOMAINS).some(
      domain => hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return false;
  }
}

export function resolveDownloadProxyList(privateProxyList: string[] = []): string[] {
  const normalizedPrivateProxies = privateProxyList
    .map(proxy => proxy.trim().replace(/\/+$/, ''))
    .filter(Boolean)
    .filter(proxy => !isLegacyPublicProxy(proxy));

  if (normalizedPrivateProxies.length > 0) {
    return normalizedPrivateProxies;
  }

  return [LOCAL_DOWNLOAD_PROXY];
}

interface ProxyStorage {
  getItem(key: string): string | null;
}

function readStringArray(value: string | null): string[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function resolveDownloadProxyListFromLocalStorage(storage: ProxyStorage): string[] {
  const preferencesValue = storage.getItem('preferences');
  if (preferencesValue) {
    try {
      const preferences = JSON.parse(preferencesValue) as { privateProxyList?: unknown };
      if (Array.isArray(preferences.privateProxyList)) {
        const privateProxyList = preferences.privateProxyList.filter(
          (item): item is string => typeof item === 'string'
        );
        return resolveDownloadProxyList(privateProxyList);
      }
    } catch {
      // Fall back to the legacy key below.
    }
  }

  return resolveDownloadProxyList(readStringArray(storage.getItem('wechat-proxy')));
}
