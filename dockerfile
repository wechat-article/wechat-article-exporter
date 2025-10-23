# 编译层
FROM node:22-alpine AS build-env

# 安装 Yarn（Alpine 包管理器方式，轻量）
RUN apk add --no-cache yarn

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件，安装依赖
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true && yarn cache clean

# 复制源代码
COPY . .

# 构建 Nuxt 应用（生成 .output 目录）
ENV NODE_ENV=production NITRO_KV_DRIVER=fs NITRO_KV_BASE=.data/kv
RUN yarn build


# 运行时层
FROM node:22-alpine

ARG VERSION=unknown

# 添加 LABEL 元数据
LABEL maintainer="findsource@proton.me" \
      version="${VERSION}" \
      description="wechat-article-exporter Docker Image" \
      org.opencontainers.image.source="https://github.com/wechat-article/wechat-article-exporter" \
      org.opencontainers.image.description="一个在线的微信公众号文章批量下载工具，支持下载阅读量与评论数据，支持私有化部署，通过浏览器进行使用，无需进行安装" \
      org.opencontainers.image.licenses="MIT"

# 设置工作目录
WORKDIR /app

# 复制构建输出
COPY --from=build-env /app/.output /app/nuxt-options.json ./

# 创建非 root 用户（使用内置 node 用户）
USER node

# 暴露端口
EXPOSE 3000

# 设置环境变量：生产模式，监听所有接口
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_PRESET=docker

# 添加健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# 启动命令：运行 Nitro 生成的服务器
ENTRYPOINT ["node", "server/index.mjs"]
