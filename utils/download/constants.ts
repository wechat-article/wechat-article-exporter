// 默认下载选项
export const DEFAULT_OPTIONS = {
  // 每个资源的下载超时时间，默认为20秒
  TIMEOUT: 20_000,

  // 每个资源的下载失败重试次数，默认为3次
  MAX_RETRIES: 3,

  // 代理进入冷静池的连续失败次数，默认为3次
  MAX_FAILURES: 3,

  // 代理进入冷静池的时间，默认为30秒
  COOLDOWN_PERIOD: 30_000,
};
