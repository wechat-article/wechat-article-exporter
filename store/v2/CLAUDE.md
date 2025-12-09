[根目录](../../../CLAUDE.md) > [store](../) > **v2**

# Store v2 模块

## 模块职责

该模块是基于Dexie（IndexedDB）的客户端数据存储层，提供文章缓存、账号信息、API调用记录等数据的持久化存储。v2版本是当前使用的存储实现。

## 入口与启动

- **主入口**: `index.ts` - 导出所有存储模块
- **数据库定义**: `db.ts` - Dexie数据库实例和表结构定义

## 对外接口

### 核心存储表

#### article.ts - 文章存储
- **主键**: `fakeid:aid` 格式
- **功能**:
  - `updateArticleCache()` - 更新文章缓存
  - `getArticleList()` - 获取文章列表
  - `getArticle()` - 获取单篇文章

#### info.ts - 账号信息存储
- **主键**: `fakeid`
- **功能**:
  - `addInfo()` - 添加账号信息
  - `getInfo()` - 获取账号信息
  - `updateLastUpdateTime()` - 更新最后更新时间

#### comment.ts - 评论存储
- **主键**: `url`
- **功能**:
  - `addComment()` - 添加评论
  - `getComment()` - 获取评论

#### 其他存储表
- `api.ts` - API调用记录
- `html.ts` - HTML内容缓存
- `assets.ts` - 资源文件缓存
- `metadata.ts` - 元数据缓存
- `debug.ts` - 调试信息

## 关键依赖与配置

- `dexie` - IndexedDB封装库
- `~/types` - TypeScript类型定义
- `~/shared/utils/helpers` - 辅助工具

## 数据模型

数据库版本演进：
- **v1**: 初始表结构
- **v2**: 添加fakeid索引
- **v3**: debug表添加fakeid索引

## 测试与质量

暂无测试文件。建议添加：
- 数据库CRUD操作测试
- 版本迁移测试
- 数据一致性测试

## 常见问题 (FAQ)

1. **Q: 如何清理过期的缓存数据？**
   A: 当前未自动清理，建议添加定期清理机制或容量限制。

2. **Q: 数据库版本迁移失败怎么办？**
   A: Dexie会自动处理版本升级，如需降级需要清除整个数据库。

3. **Q: 存储容量限制是多少？**
   A: IndexedDB通常限制为可用磁盘空间的50%，但具体取决于浏览器。

## 相关文件清单

```
store/v2/
├── index.ts               # 导出所有模块
├── db.ts                  # 数据库定义
├── api.ts                 # API调用记录
├── article.ts             # 文章存储
├── assets.ts              # 资源文件存储
├── comment.ts             # 评论存储
├── comment_reply.ts       # 评论回复存储
├── debug.ts               # 调试信息存储
├── html.ts                # HTML内容缓存
├── info.ts                # 账号信息存储
├── metadata.ts            # 元数据缓存
├── resource.ts            # 资源存储
├── resource-map.ts        # 资源映射
└── CLAUDE.md             # 本文档
```

## 变更记录 (Changelog)

### 2025-12-08 12:19:14
- 创建模块文档
- 记录数据库版本历史
- 列出所有存储表及功能