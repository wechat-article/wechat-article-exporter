import type { ProxyStatus } from './types';
import { DEFAULT_OPTIONS } from './constants';

export class ProxyManager {
  private readonly proxies: string[];
  private readonly proxyStatus: Map<string, ProxyStatus>;
  private readonly cooldownPeriod: number;
  private readonly maxFailures: number;

  constructor(
    proxies: string[],
    cooldownPeriod = DEFAULT_OPTIONS.COOLDOWN_PERIOD,
    maxFailures = DEFAULT_OPTIONS.MAX_FAILURES
  ) {
    if (!proxies.length) {
      throw new Error('至少需要配置一个代理');
    }

    this.proxies = [...proxies];
    this.proxyStatus = new Map();
    this.cooldownPeriod = cooldownPeriod;
    this.maxFailures = maxFailures;
    this.initProxyStatus();
  }

  private initProxyStatus(): void {
    this.proxies.forEach(proxy => {
      this.proxyStatus.set(proxy, {
        failures: 0,
        lastUsed: 0,
        cooldown: false,
        totalFailures: 0,
        totalSuccess: 0,
        totalUse: 0,
      });
    });
  }

  // 获取最佳代理
  public getBestProxy(): string {
    const now = Date.now();
    const availableProxies = Array.from(this.proxyStatus.entries())
      .filter(([_, status]) => !status.cooldown || now - status.lastUsed >= this.cooldownPeriod)
      .sort((a, b) => {
        if (a[1].failures !== b[1].failures) {
          return a[1].failures - b[1].failures;
        }
        return a[1].lastUsed - b[1].lastUsed;
      });

    if (availableProxies.length === 0) {
      return this.resetAndGetProxy();
    }

    const [bestProxy, status] = availableProxies[0];
    status.lastUsed = now;
    status.totalUse++;
    return bestProxy;
  }

  // 无可用代理时，返回最早使用的代理
  private resetAndGetProxy(): string {
    const [oldestProxy, status] = Array.from(this.proxyStatus.entries()).sort(
      ([, a], [, b]) => a.lastUsed - b.lastUsed
    )[0];

    this.proxyStatus.set(oldestProxy, {
      ...status,
      failures: 0,
      cooldown: false,
      lastUsed: Date.now(),
      totalUse: status.totalUse + 1,
    });

    return oldestProxy;
  }

  // 记录代理失败
  public recordFailure(proxy: string): void {
    const status = this.proxyStatus.get(proxy);
    if (!status) return;

    status.failures++;
    status.totalFailures++;

    // 连续失败指定次数则进入冷却
    status.cooldown = status.failures >= this.maxFailures;
  }

  // 记录代理成功
  public recordSuccess(proxy: string): void {
    const status = this.proxyStatus.get(proxy);
    if (!status) return;

    status.failures = 0;
    status.cooldown = false;
    status.totalSuccess++;
  }

  // 获取代理状态
  public getProxyStatus(): Map<string, ProxyStatus> {
    return new Map(this.proxyStatus);
  }
}
