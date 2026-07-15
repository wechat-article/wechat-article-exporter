import { getResourceCache, updateResourceCache, type ResourceAsset } from '~/store/v2/resource';

export interface ResourceFetchState {
  pending: Set<string>;
  completed: Set<string>;
  failed: Set<string>;
}

export interface ResourceFetchProxyManager {
  getBestProxy(): string;
  recordSuccess(proxy: string): void;
}

export interface ResourceFetchTaskOptions {
  url: string;
  fakeid: string;
  maxRetries: number;
  state: ResourceFetchState;
  proxyManager: ResourceFetchProxyManager;
  download: (fakeid: string, url: string, proxy: string) => Promise<Blob>;
  handleDownloadFailure: (proxy: string, url: string, attempt: number, error: unknown) => Promise<void>;
  getCachedResource?: (url: string) => Promise<ResourceAsset | undefined>;
  updateCachedResource?: (resource: ResourceAsset) => Promise<unknown>;
}

export interface ResourceFetchTaskResult {
  status: 'cached' | 'downloaded' | 'failed';
  attempts: number;
  proxy?: string;
}

export async function runResourceFetchTask(options: ResourceFetchTaskOptions): Promise<ResourceFetchTaskResult> {
  const {
    url,
    fakeid,
    maxRetries,
    state,
    proxyManager,
    download,
    handleDownloadFailure,
    getCachedResource = getResourceCache,
    updateCachedResource = updateResourceCache,
  } = options;

  state.pending.add(url);

  const cached = await getCachedResource(url);
  if (cached) {
    state.pending.delete(url);
    state.completed.add(url);
    return {
      status: 'cached',
      attempts: 0,
    };
  }

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const proxy = proxyManager.getBestProxy();

    try {
      const file = await download(fakeid, url, proxy);
      await updateCachedResource({
        fakeid,
        url,
        file,
      });
      state.pending.delete(url);
      state.completed.add(url);
      proxyManager.recordSuccess(proxy);
      return {
        status: 'downloaded',
        attempts: attempt + 1,
        proxy,
      };
    } catch (error) {
      await handleDownloadFailure(proxy, url, attempt, error);
    }
  }

  state.pending.delete(url);
  state.failed.add(url);
  return {
    status: 'failed',
    attempts: maxRetries,
  };
}
