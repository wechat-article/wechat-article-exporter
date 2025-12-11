# 部署与配置指南

## 开发环境配置

### 1. 环境要求

- Node.js >= 18
- MySQL >= 8.0
- pnpm 或 yarn

### 2. 安装依赖

```bash
pnpm install
```

### 3. 环境变量配置

复制 `.env.example` 为 `.env` 并配置：

```bash
# MySQL 配置
NUXT_MYSQL_HOST=127.0.0.1
NUXT_MYSQL_PORT=3306
NUXT_MYSQL_USER=wechat_exporter
NUXT_MYSQL_PASSWORD=your_password
NUXT_MYSQL_DATABASE=wechat_exporter

# 启用 MySQL 后端
NUXT_USE_MYSQL=true

# KV 存储驱动（开发环境使用 fs，生产可用 memory）
# NITRO_KV_DRIVER=fs
# NITRO_KV_BASE=./.data/kv
```

### 4. 初始化数据库

```bash
mysql -u root -p < server/db/schema.sql
```

### 5. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

---

## 生产环境部署

### Cloudflare Workers

1. 配置 `wrangler.toml`
2. 设置 Cloudflare KV 命名空间
3. 配置环境变量

```bash
wrangler deploy
```

### Docker 部署

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
RUN pnpm install && pnpm build
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

---

## 关键配置说明

### KV 存储驱动

| 环境变量 | 说明 | 默认值 |
|---------|------|--------|
| `NITRO_KV_DRIVER` | 存储驱动类型 | 开发: `fs`, 生产: `memory` |
| `NITRO_KV_BASE` | 文件存储路径 | `./.data/kv` |

支持的驱动：
- `memory` - 内存存储（服务重启后丢失）
- `fs` - 文件系统存储
- `cloudflare-kv-binding` - Cloudflare KV

### MySQL 配置

| 环境变量 | 说明 |
|---------|------|
| `NUXT_MYSQL_HOST` | 数据库主机 |
| `NUXT_MYSQL_PORT` | 数据库端口 |
| `NUXT_MYSQL_USER` | 数据库用户名 |
| `NUXT_MYSQL_PASSWORD` | 数据库密码 |
| `NUXT_MYSQL_DATABASE` | 数据库名称 |
| `NUXT_USE_MYSQL` | 是否启用 MySQL (`true`/`false`) |

---

## 数据库迁移

如果已有数据库需要更新表结构：

```bash
# 添加 owner_id 字段
mysql -u user -p database < server/db/migration_add_owner_id.sql

# 修复 title 列长度
mysql -u user -p database < server/db/migration_fix_title_length.sql
```
