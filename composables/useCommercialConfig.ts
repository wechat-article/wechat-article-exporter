/**
 * 商业化 / 部署相关运行时配置（文档站、指标等）。
 */
export function useCommercialConfig() {
  const publicConfig = useRuntimeConfig().public;

  return {
    docsWebsiteUrl: (publicConfig.docsWebsiteUrl as string) || '',
    wxdownReleasesUrl: (publicConfig.wxdownReleasesUrl as string) || '',
    metricsEndpoint: (publicConfig.metricsEndpoint as string) || '',
    /** 与账号 plan 对齐的 Pro 能力判断占位，后续可接真实计费 */
    isProPlan(plan: string | undefined) {
      return plan === 'pro';
    },
  };
}
