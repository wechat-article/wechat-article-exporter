[根目录](../../../CLAUDE.md) > [server](../) > **api**

# API 路由模块

## 模块职责

该模块包含所有服务端API路由实现，分为公开API（public）和需要认证的Web API（web），处理所有前后端数据交互。

## 入口与启动

使用Nuxt 3的文件系统路由，每个`.get.ts`、`.post.ts`文件都是一个独立的API端点。

### 公开 API (public/v1)
- `account.get.ts` - 公众号搜索
- `article.get.ts` - 文章列表获取
- `download.get.ts` - 文章下载
- `authkey.get.ts` - 认证密钥
- `accountbyurl.get.ts` - 通过URL获取账号

### Web API (需要认证)
#### 登录相关 (login)
- `getqrcode.get.ts` - 获取登录二维码
- `scan.get.ts` - 扫码状态检查
- `bizlogin.post.ts` - 业务登录
- `session/[sid].post.ts` - Session管理

#### 公众号相关 (mp)
- `searchbiz.get.ts` - 搜索公众号
- `appmsgpublish.get.ts` - 获取文章列表
- `info.get.ts` - 获取公众号信息
- `logout.get.ts` - 登出
- `searchbyurl.get.ts` - 通过URL搜索

#### 杂项 (misc)
- `comment.get.ts` - 获取评论
- `accountname.get.ts` - 获取账号名称
- `appmsgalbum.get.ts` - 获取文章合集
- `status.get.ts` - 获取状态

## 对外接口

### 认证机制
- Web API需要通过Cookie中的session进行认证
- 使用 `getTokenFromStore()` 从KV存储获取token

### 代理请求
所有API都通过 `proxyMpRequest` 函数代理到微信公众号API，实现：
- 统一的错误处理
- 请求日志记录
- Cookie管理

## 关键依赖与配置

- `~/server/utils/CookieStore` - Cookie存储管理
- `~/server/utils/proxy-request` - 代理请求工具
- `~/server/utils/logger` - 日志工具
- Nitro KV存储 - 服务端数据存储

## 数据模型

- `AppMsgPublishResponse` - 文章列表响应
- `SearchBizResponse` - 搜索公众号响应
- `CommentResponse` - 评论响应

## 测试与质量

暂无测试文件。建议添加：
- API端点测试
- 认证流程测试
- 错误处理测试

## 常见问题 (FAQ)

1. **Q: 如何处理API请求频率限制？**
   A: 当前未实现服务端限流，建议添加Redis或内存存储的限流中间件。

2. **Q: Session过期如何处理？**
   A: 当ret=200003时表示session过期，需要前端重新登录。

3. **Q: 如何调试API请求？**
   A: 启用 `runtimeConfig.debugMpRequest` 可查看详细请求日志。

## 相关文件清单

```
server/api/
├── _debug.get.ts                 # 调试端点
├── public/                       # 公开API
│   ├── v1/                      # v1版本API
│   └── beta/                    # beta版API
└── web/                         # 需要认证的API
    ├── login/                   # 登录相关
    ├── mp/                      # 公众号相关
    └── misc/                    # 杂项功能
└── CLAUDE.md                    # 本文档
```

## 变更记录 (Changelog)

### 2025-12-08 12:19:14
- 创建模块文档
- 整理API端点分类
- 记录认证机制和依赖