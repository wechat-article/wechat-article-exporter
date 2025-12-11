# 数据库 Schema 文档

## 概述

本项目使用 MySQL 作为持久化存储，支持多账号数据隔离。所有表都包含 `owner_id` 字段作为复合主键的一部分。

---

## 表结构概览

| 表名 | 说明 | 主键 |
|-----|------|-----|
| `info` | 公众号信息 | `(owner_id, fakeid)` |
| `article` | 文章列表 | `(owner_id, id)` |
| `metadata` | 文章元数据（阅读量等） | `(owner_id, url_hash)` |
| `html` | HTML 内容缓存 | `(owner_id, url_hash)` |
| `asset` | 资源文件（图片等） | `(owner_id, url_hash)` |
| `resource` | 资源文件备份 | `(owner_id, url_hash)` |
| `resource_map` | 资源 URL 映射 | `(owner_id, url_hash)` |
| `comment` | 评论数据 | `(owner_id, url_hash)` |
| `comment_reply` | 评论回复 | `(owner_id, id)` |
| `debug` | 调试数据 | `(owner_id, url_hash)` |
| `api_call` | API 调用记录 | `id (AUTO_INCREMENT)` |

---

## 表详细设计

### info - 公众号信息表

| 字段 | 类型 | 说明 |
|-----|------|------|
| `owner_id` | VARCHAR(64) | 登录账号标识 (nick_name 的 MD5) |
| `fakeid` | VARCHAR(64) | 公众号唯一标识 |
| `completed` | TINYINT(1) | 是否已完成同步 |
| `count` | INT | 已同步的消息数 |
| `articles` | INT | 已同步的文章数 |
| `nickname` | VARCHAR(255) | 公众号昵称 |
| `round_head_img` | TEXT | 公众号头像 URL |
| `total_count` | INT | 文章总数 |
| `create_time` | INT UNSIGNED | 创建时间戳 |
| `update_time` | INT UNSIGNED | 更新时间戳 |
| `last_update_time` | INT UNSIGNED | 最后更新时间戳 |

### article - 文章表

| 字段 | 类型 | 说明 |
|-----|------|------|
| `owner_id` | VARCHAR(64) | 登录账号标识 |
| `id` | VARCHAR(128) | 主键: `fakeid:aid` |
| `fakeid` | VARCHAR(64) | 公众号标识 |
| `aid` | VARCHAR(64) | 文章 ID |
| `title` | VARCHAR(1000) | 文章标题 |
| `link` | TEXT | 文章链接 |
| `cover` | TEXT | 封面图 URL |
| `digest` | TEXT | 文章摘要 |
| `author_name` | VARCHAR(255) | 作者名称 |
| `create_time` | INT UNSIGNED | 创建时间戳 |
| `update_time` | INT UNSIGNED | 更新时间戳 |
| `is_deleted` | TINYINT(1) | 是否已删除 |
| `data` | JSON | 完整的 AppMsgEx 对象数据 |

### html - HTML 内容表

| 字段 | 类型 | 说明 |
|-----|------|------|
| `owner_id` | VARCHAR(64) | 登录账号标识 |
| `url` | VARCHAR(2048) | 文章 URL |
| `url_hash` | VARCHAR(64) | URL 的 MD5 哈希值 |
| `fakeid` | VARCHAR(64) | 公众号标识 |
| `title` | VARCHAR(1000) | 文章标题 |
| `comment_id` | VARCHAR(64) | 评论 ID |
| `file` | LONGBLOB | HTML 内容 (二进制) |
| `create_time` | INT UNSIGNED | 创建时间戳 |

### metadata - 元数据表

| 字段 | 类型 | 说明 |
|-----|------|------|
| `owner_id` | VARCHAR(64) | 登录账号标识 |
| `url` | VARCHAR(2048) | 文章 URL |
| `url_hash` | VARCHAR(64) | URL 的 MD5 哈希值 |
| `fakeid` | VARCHAR(64) | 公众号标识 |
| `title` | VARCHAR(1000) | 文章标题 |
| `read_num` | INT | 阅读数 |
| `old_like_num` | INT | 点赞数 (旧) |
| `share_num` | INT | 分享数 |
| `like_num` | INT | 喜欢数 |
| `comment_num` | INT | 评论数 |

---

## SQL 文件

所有 SQL 文件已复制到本目录：

| 文件 | 说明 |
|-----|------|
| [schema.sql](./schema.sql) | 完整表结构定义 |
| [migration_add_owner_id.sql](./migration_add_owner_id.sql) | 添加 owner_id 字段迁移 |
| [migration_fix_title_length.sql](./migration_fix_title_length.sql) | 修复 title 列长度 |

原始文件位置：`server/db/`

---

## 多账号数据隔离

所有数据查询都必须包含 `owner_id` 条件：

```sql
-- 正确示例
SELECT * FROM article WHERE owner_id = ? AND fakeid = ?;

-- 错误示例（会返回所有用户数据）
SELECT * FROM article WHERE fakeid = ?;
```

`owner_id` 的生成方式：
```typescript
const ownerId = crypto.createHash('md5').update(nick_name).digest('hex');
```
