// 偏好设置
export interface Preferences {
  // 隐藏已删除文章
  hideDeleted: boolean;

  // 私有代理列表
  privateProxyList: string[];

  // 私有代理认证密钥
  privateProxyAuthorization: string;

  // 导出配置
  exportConfig: ExportConfig;

  // 下载配置
  downloadConfig: DownloadConfig;

  // 公众号同步频率(单位:秒)
  accountSyncSeconds: number;

  api_auth: APIAuth | null;

  syncDateRange: '1d' | '3d' | '7d' | '1m' | '3m' | '6m' | '1y' | 'all';
}

interface ExportConfig {
  // 目录名格式
  dirname: string;

  // 导出json中是否包含文章内容
  exportJsonIncludeContent: boolean;

  // 导出json中是否包含评论
  exportJsonIncludeComments: boolean;

  // 导出excel中是否包含文章内容
  exportExcelIncludeContent: boolean;

  // 导出html中是否包含评论
  exportHtmlIncludeComments: boolean;
}

interface DownloadConfig {
  // 抓取文章内容时，不检查缓存，强制下载最新内容
  forceDownloadContent: boolean;
}

interface APIAuth {
  token: string;
  nickname: string;
}
