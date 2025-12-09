[根目录](../../CLAUDE.md) > **composables**

# Composables 模块

## 模块职责

该模块包含所有Vue 3组合式函数（Composables），提供可复用的状态管理和业务逻辑封装，包括导出功能、登录管理、下载管理、消息提示等。

## 入口与启动

该模块是一个函数集合，各函数独立导出。核心函数包括：

### useExporter.ts
- **功能**: 管理导出任务（Excel/JSON/HTML等格式）
- **主要方法**:
  - `export2excel(urls)` - 导出Excel
  - `export2json(urls)` - 导出JSON
  - `export2html(urls)` - 导出HTML
  - `export2markdown(urls)` - 导出Markdown
  - `export2docx(urls)` - 导出Word

### useLoginAccount.ts
- **功能**: 管理登录账号状态
- **返回**: `Ref<Info | null>` - 当前登录账号信息

### useBatchDownload.ts
- **功能**: 批量下载管理
- **特性**: 队列管理、进度跟踪、错误重试

### toast.ts
- **功能**: 消息提示工厂
- **返回**: `toast` 实例，支持 success/error/warning/info 等类型

## 对外接口

每个composable都是独立的函数，使用方式：

```typescript
// 导出功能
const { export2excel, export2json, loading, phase } = useExporter()

// 登录账号
const loginAccount = useLoginAccount()

// 消息提示
const toast = toastFactory()
```

## 关键依赖与配置

- `~/utils/download` - 下载工具类
- `~/store/v2` - 数据存储
- `~/types` - 类型定义
- Vue 3 Composition API
- VueUse 工具集

## 数据模型

- `ExporterStatus` - 导出状态类型
- `Info` - 账号信息类型
- `ToastOptions` - 消息提示配置

## 测试与质量

暂无测试文件。建议添加：
- 各composable的功能测试
- 状态管理测试
- 错误处理测试

## 常见问题 (FAQ)

1. **Q: 如何实现导出任务的取消功能？**
   A: 当前导出器未实现取消功能，需要在Exporter类中添加AbortController支持。

2. **Q: 批量下载的并发数如何控制？**
   A: 当前使用p-queue库控制并发，默认值在constants中配置。

3. **Q: 登录状态过期如何处理？**
   A: useLoginCheck函数会自动检测并处理session过期。

## 相关文件清单

```
composables/
├── toast.ts                 # 消息提示
├── useAccountEventBus.ts    # 账号事件总线
├── useBatchDownload.ts      # 批量下载
├── useDownloader.ts         # 下载器
├── useExporter.ts           # 导出功能
├── useLoginAccount.ts       # 登录账号管理
├── useLoginCheck.ts         # 登录状态检查
├── usePreferences.ts        # 用户偏好设置
├── useSyncDeadline.ts       # 同步截止时间
└── CLAUDE.md               # 本文档
```

## 变更记录 (Changelog)

### 2025-12-08 12:19:14
- 创建模块文档
- 列出所有composables及其功能
- 记录使用方式和依赖关系