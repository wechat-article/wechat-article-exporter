import { PUBLIC_PROXY_LIST } from '../../config/public-proxy';

export const LOCAL_DOWNLOAD_PROXY = '/api/web/proxy/download';

function normalizeProxyUrl(proxy: string): string {
  return proxy.trim().replace(/\/+$/, '');
}

const PUBLIC_PROXY_SET = new Set(PUBLIC_PROXY_LIST.map(normalizeProxyUrl));

function normalizePrivateProxyList(privateProxyList: string[]): string[] {
  return privateProxyList.map(normalizeProxyUrl).filter(proxy => proxy && !PUBLIC_PROXY_SET.has(proxy));
}

export function isBrowserContext(): boolean {
  return typeof window !== 'undefined' && window.location.protocol !== 'file:';
}

export function resolveDownloadProxyList(privateProxyList: string[] = []): string[] {
  const normalizedPrivateProxies = normalizePrivateProxyList(privateProxyList);

  if (normalizedPrivateProxies.length > 0) {
    return normalizedPrivateProxies;
  }

  if (isBrowserContext()) {
    return [LOCAL_DOWNLOAD_PROXY];
  }

  return [...PUBLIC_PROXY_LIST];
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
