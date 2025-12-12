# 数据库文档

## 概述

本项目使用 **MySQL 8.0+** 作为持久化存储后端，支持多账号数据隔离。所有业务表都包含 `owner_id` 字段作为复合主键的一部分，实现不同登录账号之间的数据隔离。

---

## 快速开始

### 1. 新安装

执行 DDL 脚本创建数据库和所有表结构：

```bash
mysql -u root -p < DDL.sql
```

---

## 文件说明

| 文件 | 类型 | 说明 |
|-----|------|------|
| [DDL.sql](./DDL.sql) | DDL | **完整的数据结构定义**：包含数据库创建、用户授权、所有表结构（11张表） |
| [DML.sql](./DML.sql) | DML | **数据操作脚本**：迁移语句、数据清理、常用查询示例 |
| [SCHEMA.md](./SCHEMA.md) | 文档 | 表结构详细设计文档 |
| [schema.sql](./schema.sql) | DDL | 原始表结构定义（仅建表语句） |
| [create_db_user.sql](./create_db_user.sql) | DDL | 数据库和用户创建脚本 |
| [migration_add_owner_id.sql](./migration_add_owner_id.sql) | DML | 添加 owner_id 字段的迁移脚本 |
| [migration_fix_title_length.sql](./migration_fix_title_length.sql) | DML | 修复 title 列长度的迁移脚本 |
| [migration_fix_article_duplicates.sql](./migration_fix_article_duplicates.sql) | DML | 清理重复文章数据的脚本 |

---

## 表结构概览

| 表名 | 说明 | 主键 | 存储内容 |
|-----|------|-----|---------|
| `info` | 公众号信息 | `(owner_id, fakeid)` | 公众号基本信息、同步状态 |
| `article` | 文章列表 | `(owner_id, id)` | 文章元信息、链接、完整数据 |
| `metadata` | 文章元数据 | `(owner_id, url_hash)` | 阅读量、点赞、分享、评论数 |
| `html` | HTML 内容 | `(owner_id, url_hash)` | 文章 HTML 源码缓存 |
| `asset` | 资源文件 | `(owner_id, url_hash)` | 图片等资源二进制 |
| `resource` | 资源备份 | `(owner_id, url_hash)` | 资源文件备份 |
| `resource_map` | 资源映射 | `(owner_id, url_hash)` | 文章与资源 URL 对应关系 |
| `comment` | 评论数据 | `(owner_id, url_hash)` | 文章评论列表 |
| `comment_reply` | 评论回复 | `(owner_id, id)` | 评论的回复内容 |
| `debug` | 调试数据 | `(owner_id, url_hash)` | 开发调试用数据 |
| `api_call` | API 记录 | `id (AUTO_INCREMENT)` | API 调用日志 |

---

## 多账号数据隔离

### owner_id 说明

`owner_id` 是登录用户昵称 (`nick_name`) 的 MD5 哈希值：

```typescript
import crypto from 'crypto';
const ownerId = crypto.createHash('md5').update(nick_name).digest('hex');
```

### 查询规范

所有数据查询都 **必须** 包含 `owner_id` 条件：

```sql
-- ✅ 正确示例
SELECT * FROM article WHERE owner_id = ? AND fakeid = ?;

-- ❌ 错误示例（会返回所有用户数据）
SELECT * FROM article WHERE fakeid = ?;
```

---

## 环境配置

在 `.env` 文件中配置 MySQL 连接信息：

```env
# MySQL 数据库配置
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=wechat-docs
MYSQL_PASSWORD=your_secure_password
MYSQL_DATABASE=wechat-docs

# 启用 MySQL 存储（false 则使用 IndexedDB）
NUXT_USE_MYSQL=true
```

---