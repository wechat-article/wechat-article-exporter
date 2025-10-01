# Cloudflare 部署指南

## 手动编译上传

### 1. 编译项目

```shell
npx nuxi build --preset=cloudflare_pages
```

### 2. 手动部署

> 首次部署时，会提示你创建一个项目。

```shell
npx wrangler pages deploy dist/
```

### 3. 绑定 KV 存储

将 kv 存储绑定在`STORAGE`变量上
