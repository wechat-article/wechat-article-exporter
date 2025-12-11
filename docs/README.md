# 项目文档目录

本目录包含项目的技术文档和架构设计。

---

## 📁 目录结构

```
docs/
├── README.md                           # 本文件 - 文档索引
├── architecture/                       # 架构设计文档
│   └── LOGIN_ARCHITECTURE.md           # 登录与会话管理架构
├── api/                                # API 文档
│   └── REST_API.md                     # REST API 参考
├── database/                           # 数据库文档
│   └── SCHEMA.md                       # 数据库表结构说明
├── deployment/                         # 部署文档
│   └── SETUP.md                        # 部署与配置指南
└── troubleshooting/                    # 故障排查
    └── FAQ.md                          # 常见问题解答
```

---

## 📖 文档清单

### 🏗️ 架构设计
| 文档 | 说明 |
|-----|------|
| [登录与会话管理](./architecture/LOGIN_ARCHITECTURE.md) | 登录流程、Cookie 管理、会话持久化、多账号隔离 |

### 📡 API 文档
| 文档 | 说明 |
|-----|------|
| [REST API](./api/REST_API.md) | API 端点、请求/响应格式、认证机制 |

### 🗄️ 数据库
| 文档 | 说明 |
|-----|------|
| [数据库 Schema](./database/SCHEMA.md) | 表结构设计、字段说明、多账号隔离 |

### 🚀 部署
| 文档 | 说明 |
|-----|------|
| [部署与配置指南](./deployment/SETUP.md) | 环境配置、数据库初始化、生产部署 |

### 🛠️ 故障排查
| 文档 | 说明 |
|-----|------|
| [常见问题解答](./troubleshooting/FAQ.md) | 登录问题、数据库问题、调试技巧 |

---

## 🔗 其他资源

| 文件 | 位置 | 说明 |
|-----|------|------|
| CLAUDE.md | 项目根目录 | 项目整体架构说明（AI 友好） |
| schema.sql | server/db/ | 完整的表结构 SQL |
| 各模块 CLAUDE.md | 各子目录 | 模块级别的代码说明 |

