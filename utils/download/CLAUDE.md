[根目录](../../../CLAUDE.md) > [utils](../) > **download**

# Download 工具模块

## 模块职责

该模块提供下载相关的核心功能实现，包括基础下载器、导出器、代理管理等功能，支持多格式文件下载和批量处理。

## 入口与启动

该模块是一个类集合，主要类包括：

### Downloader.ts
- **功能**: 基础下载器类
- **特性**:
  - 支持断点续传
  - 自动重试机制
  - 进度回调

### Exporter.ts
- **功能**: 多格式导出器
- **支持格式**: Excel, JSON, HTML, Markdown, DOCX, TXT
- **事件系统**:
  - `export:begin` - 开始导出
  - `export:progress` - 导出进度
  - `export:finish` - 完成导出

### ProxyManager.ts
- **功能**: 代理管理器
- **特性**:
  - 代理轮换
  - 失败自动切换
  - 代理健康检查

## 对外接口

### 使用示例

```typescript
// 基础下载
const downloader = new Downloader({
  url: 'xxx',
  onProgress: (p) => console.log(p)
});

// 多格式导出
const exporter = new Exporter(urls);
await exporter.startExport('excel');

// 代理管理
const proxyManager = new ProxyManager();
const proxy = proxyManager.getProxy();
```

## 关键依赖与配置

- `jszip` - ZIP文件创建
- `file-saver` - 文件保存
- `exceljs` - Excel文件处理
- `turndown` - Markdown转换
- `~/config` - 配置文件
- `~/types/download/types.d.ts` - 类型定义

## 数据模型

- `DownloadOptions` - 下载配置选项
- `ExporterStatus` - 导出状态
- `ProxyConfig` - 代理配置

## 测试与质量

暂无测试文件。建议添加：
- 下载功能测试
- 导出格式测试
- 代理切换测试

## 常见问题 (FAQ)

1. **Q: 如何处理大文件下载？**
   A: Downloader支持流式下载和分块处理，适合大文件场景。

2. **Q: 导出HTML时如何处理相对路径？**
   A: Exporter会自动处理相对路径，将其转换为绝对路径或打包进ZIP。

3. **Q: 代理失败如何处理？**
   A: ProxyManager会自动检测代理状态并切换到可用代理。

## 相关文件清单

```
utils/download/
├── BaseDownload.ts         # 基础下载类
├── Downloader.ts          # 下载器实现
├── Exporter.ts            # 导出器实现
├── ProxyManager.ts        # 代理管理器
├── constants.ts           # 常量定义
├── types.d.ts             # 类型定义
└── CLAUDE.md             # 本文档
```

## 变更记录 (Changelog)

### 2025-12-08 12:19:14
- 创建模块文档
- 记录核心类及其功能
- 列出使用方式和依赖关系