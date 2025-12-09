[根目录](../../../CLAUDE.md) > [pages](../) > **dashboard**

# Dashboard 页面模块

## 模块职责

该模块包含仪表板下的所有页面组件，是应用的核心功能页面，包括账号管理、文章管理、合集管理、API文档、设置等。

## 入口与启动

该模块是一个页面集合，每个.vue文件都是一个独立路由页面：

- `account.vue` - 账号管理页面（默认首页）
- `article.vue` - 文章管理页面
- `album.vue` - 合集管理页面
- `api.vue` - API文档页面
- `settings.vue` - 设置页面
- `single.vue` - 单篇文章页面
- `support.vue` - 支持页面
- `proxy.vue` - 代理设置页面

## 对外接口

### 路由结构
```
/dashboard/account      - 账号管理
/dashboard/article      - 文章管理
/dashboard/album        - 合集管理
/dashboard/api          - API文档
/dashboard/settings     - 设置
/dashboard/single       - 单篇文章
/dashboard/support      - 支持
/dashboard/proxy        - 代理设置
```

### 页面功能

#### account.vue
- **功能**: 搜索和管理公众号账号
- **特性**:
  - 批量搜索
  - 账号信息展示
  - 快速操作入口

#### article.vue
- **功能**: 管理和导出文章
- **特性**:
  - 高级筛选
  - 批量选择
  - 多格式导出
  - 实时预览

#### album.vue
- **功能**: 管理公众号合集
- **特性**:
  - 合集列表
  - 批量下载
  - 合集文章展示

## 关键依赖与配置

- `~/components` - UI组件库
- `~/composables` - 组合式函数
- `~/apis` - API调用
- `~/store/v2` - 数据存储
- AG-Grid Enterprise - 数据表格

## 数据模型

- 使用store/v2中的数据模型
- AG-Grid的Row Data配置
- 各页面的表单和筛选模型

## 测试与质量

暂无测试文件。建议添加：
- 页面渲染测试
- 用户交互测试
- 路由导航测试

## 常见问题 (FAQ)

1. **Q: 如何添加新的仪表板页面？**
   A: 在该目录下创建新的.vue文件，Nuxt会自动生成路由。

2. **Q: 页面间数据如何共享？**
   A: 使用composables或store/v2进行状态管理。

3. **Q: 如何实现页面缓存？**
   A: 使用Nuxt的keepalive或手动管理数据缓存。

## 相关文件清单

```
pages/dashboard/
├── account.vue         # 账号管理
├── album.vue           # 合集管理
├── api.vue             # API文档
├── article.vue         # 文章管理
├── proxy.vue           # 代理设置
├── settings.vue        # 设置页面
├── single.vue          # 单篇文章
├── support.vue         # 支持页面
└── CLAUDE.md          # 本文档
```

## 变更记录 (Changelog)

### 2025-12-08 12:19:14
- 创建模块文档
- 列出所有页面及功能
- 记录路由结构和依赖关系