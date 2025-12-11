# REST API 文档

## 概述

本项目使用 Nuxt Server 提供 REST API，主要分为以下几类：
- **登录 API** - 微信公众号登录相关
- **数据 API** - 数据库 CRUD 操作
- **公共 API** - 无需登录的公共接口

---

## 认证机制

### Cookie 认证
所有需要登录的 API 都通过 `auth-key` Cookie 进行认证：

```
Cookie: auth-key=abc123def456...
```

### Header 认证（可选）
也支持通过 Header 传递：

```
X-Auth-Key: abc123def456...
X-Owner-Id: 5d41402abc4b2a76b9719d911017c592
```

---

## 登录 API

### POST /api/web/login/prelogin
获取登录二维码

**响应**：
```json
{
  "qrcode": "https://mp.weixin.qq.com/..."
}
```

### POST /api/web/login/ask
轮询扫码状态

**响应**：
```json
{
  "status": 0,  // 0=等待, 1=已扫码, 4=已确认
  "nickname": "公众号名称"
}
```

### POST /api/web/login/bizlogin
完成登录

**响应**：
```json
{
  "nickname": "公众号名称",
  "avatar": "https://...",
  "ownerId": "5d41402abc4b2a76b9719d911017c592",
  "expires": "2025-12-15T10:00:00Z"
}
```

---

## 数据 API

### GET /api/db/info
获取公众号列表

**响应**：
```json
{
  "code": 0,
  "data": [
    {
      "fakeid": "MzA...",
      "nickname": "公众号名称",
      "articles": 100,
      "completed": true
    }
  ]
}
```

### POST /api/db/article
获取文章列表

**请求**：
```json
{
  "fakeid": "MzA...",
  "page": 1,
  "pageSize": 20
}
```

**响应**：
```json
{
  "code": 0,
  "data": {
    "list": [...],
    "total": 100
  }
}
```

### POST /api/db/data
通用数据 CRUD

**请求**：
```json
{
  "table": "html",           // 表名
  "action": "get" | "set",   // 操作类型
  "key": "https://...",      // 查询键（get 时使用）
  "data": {...}              // 数据（set 时使用）
}
```

**响应**：
```json
{
  "code": 0,
  "data": {...},
  "message": "success"
}
```

#### 支持的表名
- `metadata` - 元数据
- `html` - HTML 内容
- `asset` - 资源文件
- `resource` - 资源备份
- `resource_map` - 资源映射
- `comment` - 评论
- `comment_reply` - 评论回复
- `debug` - 调试数据
- `api` - API 调用记录

---

## 公共 API

### GET /api/public/v1/authkey
验证 auth-key 是否有效

**响应**：
```json
{
  "code": 0,      // 0=有效, -1=无效
  "data": "abc123..."
}
```

---

## 错误响应

所有 API 错误都返回以下格式：

```json
{
  "code": -1,
  "data": null,
  "message": "Error description"
}
```

常见错误消息：
- `Unauthorized: owner_id not found` - 未登录或会话过期
- `Missing table or action parameter` - 缺少必要参数
- `Data operation failed` - 数据库操作失败
