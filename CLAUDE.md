# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在本仓库中工作时提供指导。

## 项目概述

微信公众号文章批量下载导出工具。基于 Nuxt 3（关闭 SSR，纯客户端 SPA）+ Vue 3 Composition API + Nitro 服务端引擎构建。支持导出 HTML/JSON/Excel/TXT/Markdown/DOCX 格式，其中 HTML 格式可 100% 还原文章排版与样式。

## 常用命令

```bash
# 安装依赖（要求 Node >= 22，yarn 1.22.22 通过 corepack 管理）
corepack enable && corepack prepare yarn@1.22.22 --activate
yarn

# 开发
yarn dev          # 启动开发服务器

# 构建与部署
yarn build        # 生产构建（输出到 .output/）
yarn preview      # 构建 Cloudflare Pages 版本并本地预览

# 代码格式化（Biome 为主要格式化工具，linter 已禁用）
yarn format       # biome check --write

# Docker
yarn docker:build
yarn docker:publish
```

## 架构

### 客户端-服务端分离

- **客户端（SPA）：** `app.vue` → `pages/dashboard.vue` 为唯一路由页面，所有 UI 均在客户端运行（SSR 已关闭）。
- **服务端（Nitro）：** `server/api/` 包含约 25 个接口端点，负责代理转发微信公众平台的 API 请求，处理 CORS 和 Cookie 转发。核心代理逻辑在 `server/utils/proxy-request.ts`。

### 核心数据流

1. 用户通过微信公众平台后台扫码登录认证
2. `apis/index.ts` 定义客户端 API 函数，调用 Nitro 代理端点
3. 文章数据获取后经过过滤，通过 Dexie 缓存到 IndexedDB（`store/v2/db.ts`）
4. 下载调度：`utils/download/Downloader.ts` 使用 `p-queue` 管理并发下载
5. 导出：`utils/download/Exporter.ts` 将文章转换为目标格式（Cheerio 处理 HTML、Turndown 转 Markdown、ExcelJS 生成表格、JSZip 打包）

### 关键目录

- `apis/` — 客户端 API 函数定义（getArticleList、getAccountList 等）
- `composables/` — Vue 3 组合式函数：`useDownloader.ts`（下载调度）、`useExporter.ts`（导出逻辑）、`useBatchDownload.ts`（批量下载管理）
- `store/v2/` — 基于 Dexie 的 IndexedDB 缓存（文章、评论、元数据、资源、HTML 内容）
- `utils/download/` — 核心下载/导出类：`Downloader.ts`、`Exporter.ts`、`BaseDownloader.ts`、`ProxyManager.ts`
- `server/api/web/mp/` — 代理微信公众平台请求的 Nitro 端点
- `server/utils/` — 服务端工具：代理请求处理、Cookie 管理、日志
- `shared/utils/` — 客户端与服务端共享代码（HTML 解析、请求工具函数）
- `config/` — 应用常量、公共 API 端点定义、AG Grid 配置
- `types/` — TypeScript 类型定义（AppMsgEx、AccountInfo、credentials、comments 等）

### UI 技术栈

Nuxt UI v2 + TailwindCSS 提供组件和样式。AG Grid Enterprise 用于文章数据表格。Monaco Editor 用于代码/调试视图。

## 代码规范

- Biome 格式化（非 lint）：行宽 120 字符、2 空格缩进、单引号、ES5 尾逗号、带分号
- CSS 使用 4 空格缩进
- Vue 文件：script/style 标签内不额外缩进
- 命名：函数/变量使用 camelCase，组件使用 PascalCase

## 环境变量

复制 `.env.example` 为 `.env`，关键变量：
- `NUXT_AGGRID_LICENSE` — AG Grid 企业版授权密钥
- `NITRO_KV_DRIVER` — 存储驱动（本地/Docker 用 `fs`，Cloudflare 用 `cloudflare-kv-binding`）
- `NITRO_KV_BASE` — KV 数据目录（默认：`.data/kv`）
- `LOG_DIR` — 日志文件保存目录（默认：`log`）
- `LOG_RETENTION_DAYS` — 日志保留天数（默认：14）
- `NUXT_DEBUG_MP_REQUEST` — 开启微信代理请求调试（仅开发环境）
- `DEBUG_KEY` — 调试端点认证密钥
- `SCHEDULER_SYNC_DAYS` — 定时任务每次回溯同步并生成文档的天数（默认：3）
