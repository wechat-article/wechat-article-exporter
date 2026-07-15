/**
 * 可选业务指标上报（需配置 NUXT_PUBLIC_METRICS_ENDPOINT）。
 */
export function useProductMetrics() {
  const { metricsEndpoint } = useCommercialConfig();

  function track(event: string, payload?: Record<string, unknown>) {
    if (!metricsEndpoint || !import.meta.client) {
      return;
    }
    const body = JSON.stringify({ event, t: Date.now(), ...payload });
    fetch(metricsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      /* 静默失败，避免影响主流程 */
    });
  }

  return { track };
}
