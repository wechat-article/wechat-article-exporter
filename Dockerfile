# 编译层
FROM node:22-alpine AS build-env

# 安装 Yarn (pin a specific Yarn version)
ARG NPM_CONFIG_REGISTRY=https://registry.npmjs.org
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm install -g yarn@1.22.22 --force --registry=${NPM_CONFIG_REGISTRY} \
    && yarn config set registry ${NPM_CONFIG_REGISTRY} \
    && yarn --version


# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件，安装依赖
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production=true --network-timeout 300000 && yarn cache clean

# 复制源代码
COPY . .

# 构建 Nuxt 应用（生成 .output 目录）；NUXT_PUBLIC_* 在 build 时写入客户端，运行时改 env 不会生效
ARG NUXT_PUBLIC_EXPORT_DIRECT_ZIP=true
ARG NUXT_PUBLIC_DOCS_WEBSITE_URL=
ARG NUXT_PUBLIC_WXDOWN_RELEASES_URL=
ENV NODE_ENV=production \
    NITRO_KV_DRIVER=fs \
    NITRO_KV_BASE=.data/kv \
    NUXT_PUBLIC_EXPORT_DIRECT_ZIP=${NUXT_PUBLIC_EXPORT_DIRECT_ZIP} \
    NUXT_PUBLIC_DOCS_WEBSITE_URL=${NUXT_PUBLIC_DOCS_WEBSITE_URL} \
    NUXT_PUBLIC_WXDOWN_RELEASES_URL=${NUXT_PUBLIC_WXDOWN_RELEASES_URL}

ENV NODE_OPTIONS=--max-old-space-size=4096
RUN yarn build


# 运行时层
FROM node:22-slim

ARG VERSION=unknown
ARG DEBIAN_MIRROR=http://deb.debian.org/debian
ARG DEBIAN_SECURITY_MIRROR=http://deb.debian.org/debian-security
ARG INSTALL_PDF_RUNTIME=false

# 添加 LABEL 元数据
LABEL maintainer="findsource@proton.me" \
      version="${VERSION}" \
      description="wechat-article-exporter Docker Image" \
      org.opencontainers.image.source="https://github.com/wechat-article/wechat-article-exporter" \
      org.opencontainers.image.description="一个在线的微信公众号文章批量下载工具，支持下载阅读量与评论数据，支持私有化部署，通过浏览器进行使用，无需进行安装" \
      org.opencontainers.image.licenses="MIT"

# PDF runtime is optional because Chromium pulls a large OS dependency tree.
RUN if [ "${INSTALL_PDF_RUNTIME}" = "true" ]; then \
    sed -i \
      -e "s|http://deb.debian.org/debian-security|${DEBIAN_SECURITY_MIRROR}|g" \
      -e "s|http://deb.debian.org/debian|${DEBIAN_MIRROR}|g" \
      /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=5 -o Acquire::http::Timeout=30 update \
    && apt-get -o Acquire::ForceIPv4=true -o Acquire::Retries=5 -o Acquire::http::Timeout=30 install -y \
      chromium-headless-shell fonts-noto-cjk fonts-noto-color-emoji ca-certificates \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*; \
  else \
    echo "Skipping optional PDF runtime install"; \
  fi

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-headless-shell
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# 设置工作目录
WORKDIR /app

# 复制构建输出
COPY --from=build-env /app/.output ./
# puppeteer 被 Rollup external 排除；仅在启用 PDF runtime 时安装，避免默认镜像拉取浏览器依赖
RUN if [ "${INSTALL_PDF_RUNTIME}" = "true" ]; then \
    npm install --no-save --ignore-scripts puppeteer@24; \
  else \
    echo "Skipping optional puppeteer runtime install"; \
  fi

# 创建 KV 存储目录并设置权限（以 root 运行，确保 node 用户可写）
RUN mkdir -p .data/kv && chown -R node:node /app

# 创建非 root 用户（使用内置 node 用户）
USER node

# 暴露端口
EXPOSE 3000

# 设置环境变量：生产模式，监听所有接口
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000

# 启动命令：运行 Nitro 生成的服务器
ENTRYPOINT ["node", "server/index.mjs"]
