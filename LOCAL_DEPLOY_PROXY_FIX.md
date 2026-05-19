# 本地部署代理问题排障记录

## 问题

本地部署 wechat-article-exporter 后，浏览器能直接打开微信公众号文章链接，但应用内"单篇文章抓取"或"下载文章内容"功能失败，表现为请求超时或 502。

## 根因

原代码的下载代理选择逻辑：

1. 如果用户配置了 `privateProxyList`，直接使用该列表
2. 否则 fallback 到硬编码的 `PUBLIC_PROXY_LIST`（`00.worker-proxy.asia`、`01.worker-proxy.asia`、`00.net-proxy.asia` 等公共 Cloudflare Worker 节点）

本地部署场景下有两个问题：

- **公共代理失效**：这些 Worker 节点非用户自有，可能已下线、限流或被网络拦截
- **浏览器残留配置**：用户之前在设置页面保存过这些公共代理地址到 localStorage，即使后续公共节点不可用，旧配置仍被当作"有效的私有代理"使用，不会 fallback

## 为什么不能直接删掉旧常量

简单删除 `PUBLIC_PROXY_LIST` 常量和 `config/public-proxy.ts` 文件，只解决代码层面不再引用。但**浏览器 localStorage 里已存储的旧配置不会自动清除**，用户仍会走失效节点。

正确做法：在运行时识别并过滤掉这些已知的公共代理域名，无论它们来自代码常量还是浏览器残留配置。

## 修复方案

### 1. 新增代理列表解析模块 `utils/download/proxy-list.ts`

- `resolveDownloadProxyList(privateProxyList)`：接受用户的私有代理列表，过滤掉已知公共代理域名（`worker-proxy.asia`、`net-proxy.asia`、`1235566.space`、`worker-proxy.shop`、`worker-proxys.cyou`、`worker-proxy.cyou`），过滤后为空则回退到本地 Nitro 端点 `/api/web/proxy/download`
- `resolveDownloadProxyListFromLocalStorage(storage)`：按优先级读取 localStorage 中的代理配置（先 `preferences` 键，后 `wechat-proxy` 键），再走上面的过滤逻辑

### 2. 新增本地下载代理端点

- `server/api/web/proxy/download.get.ts`：Nitro 端点，接收 `url` 和可选 `headers` 参数，代理请求到微信资源域名
- `server/utils/download-proxy.ts`：请求头注入（Referer/Origin/User-Agent）、域名白名单校验（只允许 `mp.weixin.qq.com`、`mmbiz.qpic.cn` 等）

### 3. 替换原有引用

- `BaseDownloader.ts`：移除 `PUBLIC_PROXY_LIST` 导入，改用 `resolveDownloadProxyList`
- `pool.ts`：移除手动读 localStorage 的代码，改用 `resolveDownloadProxyListFromLocalStorage`

### 4. 测试

- `test/download_proxy_list.ts`：验证代理列表解析逻辑（空列表回退、公共代理过滤、混合列表过滤）
- `test/download_proxy_target.ts`：验证下载代理端点（域名白名单、URL 规范化、请求头构建）

## 本地部署不需要公共节点

本地部署时 Nitro 服务和浏览器同源，下载代理走 `/api/web/proxy/download` 即可，无需任何外部代理节点。修复后的默认行为：

| 场景 | 代理列表 |
|------|---------|
| 无私有代理配置 | `/api/web/proxy/download`（本地 Nitro） |
| 仅有历史公共代理 | `/api/web/proxy/download`（过滤后回退） |
| 有真实私有代理 | 用户配置的私有代理（公共代理被过滤） |

## 验证步骤

1. 启动开发服务器：`yarn dev`
2. 打开浏览器 DevTools → Network 面板
3. 在应用内执行单篇文章抓取
4. 确认请求走 `/api/web/proxy/download?url=...`，而非 `00.worker-proxy.asia` 等外部域名
5. 确认抓取成功返回文章 HTML

## 测试运行

```bash
npx tsx test/download_proxy_list.ts
npx tsx test/download_proxy_target.ts
```

## 桌面版可行性分析

**结论：可行，推荐 Tauri 2。**

### 为什么可行

当前项目已是 SPA + 内嵌服务端架构：Nuxt 3 关闭 SSR 后客户端是纯 SPA，Nitro 服务端本质是 Node.js HTTP 服务，两者都能在没有浏览器地址栏的环境下运行——这就是 Electron/Tauri 的基本模型。

### 为什么选 Tauri 2 而非 Electron

| 维度 | Tauri 2 | Electron |
|------|---------|----------|
| 安装包体积 | ~10MB（Rust runtime + 系统 WebView） | ~150MB（内嵌 Chromium + Node） |
| 内存占用 | 系统 WebView 共享进程 | 独立 Chromium 进程 |
| 安全模型 | Rust 侧命令通道，最小权限 | `ipcMain` 全权限通道 |
| 桌面端能力 | 原生菜单、托盘、自动更新均内置 | 需额外交互配置 |
| Chromium 依赖 | 无（用系统 WebView） | 必须内嵌 |

本项目不需要 Puppeteer/Chromium（PDF 导出是 Docker 专属可选功能），不依赖 Electron 的完整 Chromium，Tauri 完全满足需求。

### 需要解决的技术点

1. **Nitro 服务端内嵌**：把 `.output/server/index.mjs` 作为 Tauri sidecar 进程启动，Tauri 2 原生支持 sidecar 管理
2. **WebView 通信**：系统 WebView 加载 `http://localhost:PORT`，体验与浏览器一致
3. **Node runtime 打包**：Tauri sidecar 不自带 Node，需要用 `pkg` 或 Node SEA（Single Executable Application）将 Nitro 产物编译为单二进制；或用 Bun 编译
4. **文件系统访问**：导出文件直接写入用户目录，不需要浏览器下载框
5. **Windows 安装器**：Tauri 内置 MSI/NSIS 生成，签名需单独处理

### 工作量与策略

- **工作量**：中等（2-3 天），大部分是打包/安装器配置，业务代码不改
- **原则**：不为了桌面版改 Web 端代码，Web 版保持独立可用；桌面版只是套壳 + 生命周期管理
- **渐进路径**：先出 sidecar 单文件化方案 → 最小 Tauri 壳跑通 → 加安装器和自动更新

## 关联 Issue

- [cloudy-liu/wechat-article-exporter#1](https://github.com/cloudy-liu/wechat-article-exporter/issues/1)
