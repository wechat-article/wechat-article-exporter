import { ProxyManager } from './ProxyManager';
import type { DownloaderStatus, DownloadOptions, Listener } from './types';
import type { ParsedCredential } from '~/types/credential';
import type { Preferences } from '~/types/preferences';
import { sleep, timeout, bestConcurrencyCount } from '~/utils';
import usePreferences from '~/composables/usePreferences';
import { PUBLIC_PROXY_LIST } from '~/config';
import { DEFAULT_OPTIONS } from './constants';
import { extractCommentId } from '~/utils/comment';

const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);
const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

// 下载器
// 支持下载文章HTML、阅读量、留言列表
// 注意：
//   1. 文章HTML可并发下载
//   2. 阅读量和留言数据由于使用了Credential，为了防止抓取过快，只能设置较低的并发量（通常为2）

export class BaseDownload {
  // protected readonly fakeid: string;
  protected readonly urls: string[];
  protected readonly pending: Set<string>;
  protected readonly completed: Set<string>;
  protected readonly failed: Set<string>;
  protected readonly deleted: Set<string>;

  protected readonly options: Required<DownloadOptions>;
  protected isProcessing: boolean;
  protected readonly abortControllers: Map<string, AbortController>;
  public readonly proxyManager: ProxyManager;
  protected events: Map<string, Listener[]>;

  constructor(urls: string[], options: DownloadOptions = {}) {
    this.validateInputs(urls);

    const proxies = (preferences.value as Preferences).privateProxyList || [];
    if (proxies.length === 0) {
      // 如果没有配置私有代理，则使用公共代理
      proxies.push(...PUBLIC_PROXY_LIST);
    }

    // this.fakeid = fakeid;
    this.urls = [...urls].reverse();
    this.pending = new Set();
    this.completed = new Set();
    this.failed = new Set();
    this.deleted = new Set();
    this.isProcessing = false;
    this.abortControllers = new Map();
    this.events = new Map();

    this.options = {
      concurrency: options.concurrency ?? bestConcurrencyCount(proxies.length),
      timeout: options.timeout ?? DEFAULT_OPTIONS.TIMEOUT,
      maxRetries: options.maxRetries ?? DEFAULT_OPTIONS.MAX_RETRIES,
      cooldownPeriod: options.cooldownPeriod ?? DEFAULT_OPTIONS.COOLDOWN_PERIOD,
      maxFailures: options.maxFailures ?? DEFAULT_OPTIONS.MAX_FAILURES,
    };

    this.proxyManager = new ProxyManager(proxies, this.options.cooldownPeriod, this.options.maxFailures);
  }

  /**
   * 添加事件监听器
   * @param type 事件类型
   * @param listener 监听器
   */
  public on(type: string, listener: Listener) {
    if (!this.events.has(type)) {
      this.events.set(type, []);
    }
    this.events.get(type)!.push(listener);
  }

  /**
   * 删除事件监听器
   * @param type 事件类型
   * @param listener 监听器
   */
  public off(type: string, listener?: Listener) {
    if (!this.events.has(type)) {
      return;
    }
    if (!listener) {
      this.events.delete(type);
    } else {
      const idx = this.events.get(type)!.indexOf(listener);
      if (idx > -1) {
        this.events.get(type)!.splice(idx, 1);
      }
    }
  }

  /**
   * 取消所有正在下载的请求
   */
  public cancelAllPending(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  /**
   * 获取下载器状态
   */
  public getStatus(): DownloaderStatus {
    return {
      pending: Array.from(this.pending),
      completed: Array.from(this.completed),
      failed: Array.from(this.failed),
      deleted: Array.from(this.deleted),
      proxy: this.proxyManager.getProxyStatus(),
    };
  }

  // 触发指定类型的监听器
  protected emit(type: string, ...args: any[]) {
    if (this.events.has(type)) {
      this.events.get(type)!.forEach(fn => {
        fn.call(type, ...args);
      });
    }
  }

  // 代理下载失败时的处理逻辑
  protected async handleDownloadFailure(proxy: string, url: string, attempt: number, error: any): Promise<void> {
    this.proxyManager.recordFailure(proxy);
    console.warn(`Attempt ${attempt + 1} failed for ${url} using ${proxy}:`, error);

    if (attempt < this.options.maxRetries - 1) {
      const delay = Math.pow(2, attempt);
      console.warn('下载失败，延迟', delay, '秒后重试');
      await sleep(1000 * delay);
    }
  }

  // 下载
  protected async download(fakeid: string, url: string, proxy: string, withCredential = false): Promise<Blob> {
    const abortController = new AbortController();
    this.abortControllers.set(url, abortController);

    try {
      const headers: Record<string, string> = {};

      // 使用设置的 credentials 来抓取元数据
      if (withCredential) {
        const targetCredential = credentials.value.find(item => item.biz === fakeid && item.valid);
        if (targetCredential) {
          headers.cookie = `pass_ticket=${targetCredential.pass_ticket};wap_sid2=${targetCredential.wap_sid2}`;
        }
      }

      const Authorization = (preferences.value as Preferences).privateProxyAuthorization || '';
      const proxyUrl = `${proxy}?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(JSON.stringify(headers))}&authorization=${Authorization}`;
      const response = (await Promise.race([
        fetch(proxyUrl, {
          signal: abortController.signal,
          referrerPolicy: 'unsafe-url',
        }),
        timeout(this.options.timeout),
      ])) as Response;

      if (!response || !response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return response.blob();
    } finally {
      this.abortControllers.delete(url);
    }
  }

  // 验证输入 urls 是否全部合法
  protected validateInputs(urls: string[]): void {
    urls.forEach(url => {
      try {
        new URL(url);
      } catch {
        throw new Error(`非法URL: ${url}`);
      }
    });
  }

  // 当获取阅读量和留言数据时，需要验证 Credential 是否设置正确
  protected validateCredential(fakeid: string): void {
    const targetCredential = credentials.value.find(item => item.biz === fakeid && item.valid);
    if (!targetCredential) {
      throw new Error('目标公众号的 Credential 未设置');
    }
  }

  // 验证文章 html 内容是否下载完整
  protected validateHTMLContent(html: string): ['Success' | 'Failure' | 'Deleted' | 'Checking', string | null] {
    const parser = new DOMParser();
    const document = parser.parseFromString(html, 'text/html');
    const $jsContent = document.querySelector('#js_content');
    const $layout = document.querySelector('#js_fullscreen_layout_padding');
    const $title = document.querySelector('head > title')!.textContent;

    const commentID = extractCommentId(html);

    if ($jsContent) {
      return ['Success', commentID];
    }
    if ($layout || $title === '该页面不存在') {
      return ['Deleted', null];
    }
    if ($title === '内容审核中') {
      return ['Checking', null];
    }
    return ['Failure', null];
  }
}
