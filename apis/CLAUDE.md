[根目录](../../CLAUDE.md) > **apis**

# APIs 模块

## 模块职责

该模块负责封装所有与微信公众号API交互的函数，包括文章列表获取、公众号搜索、评论数据获取等核心功能。

## 入口与启动

- **主入口**: `index.ts`
- **核心功能**:
  - `getArticleList()` - 获取文章列表
  - `getAccountList()` - 获取公众号列表
  - `getComment()` - 获取评论数据

## 对外接口

### getArticleList(account, begin, keyword)
获取指定公众号的文章列表
- **参数**:
  - `account: Info` - 公众号信息
  - `begin: number` - 起始位置（默认0）
  - `keyword: string` - 搜索关键词（默认空）
- **返回**: `Promise<[AppMsgEx[], boolean, number]>` - 文章列表、是否加载完毕、总数

### getAccountList(begin, keyword)
搜索公众号列表
- **参数**:
  - `begin: number` - 起始位置（默认0）
  - `keyword: string` - 搜索关键词（默认空）
- **返回**: `Promise<[AccountInfo[], boolean]>` - 公众号列表、是否加载完毕

### getComment(commentId)
获取文章评论
- **参数**: `commentId: string` - 评论ID
- **返回**: `Promise<CommentResponse | null>` - 评论数据

## 关键依赖与配置

- `#shared/utils/request` - HTTP请求工具
- `~/config` - 配置常量（如分页大小）
- `~/store/v2/article` - 文章缓存存储
- `~/store/v2/info` - 账号信息存储

## 数据模型

- `AppMsgEx` - 文章信息类型
- `AccountInfo` - 公众号信息类型
- `CommentResponse` - 评论响应类型

## 测试与质量

暂无测试文件，建议添加单元测试覆盖：
- API调用成功场景
- 错误处理（如session过期）
- 缓存更新逻辑

## 常见问题 (FAQ)

1. **Q: 如何处理API调用频率限制？**
   A: 目前未实现限流机制，建议添加请求队列或延迟调用。

2. **Q: 缓存更新策略是什么？**
   A: 只有关键词为空的搜索结果会更新缓存，带搜索关键词的结果不缓存。

## 相关文件清单

```
apis/
├── index.ts              # 主入口文件，包含所有API调用函数
└── CLAUDE.md            # 本文档
```

## 变更记录 (Changelog)

### 2025-12-08 12:19:14
- 创建模块文档
- 标识核心API接口
- 记录依赖关系