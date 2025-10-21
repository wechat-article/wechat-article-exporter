# 编译层
FROM node:22-alpine AS build-env

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件，安装依赖
COPY package*.json ./
RUN npm ci --quiet

# 复制源代码
COPY . .

# 构建 Nuxt 应用（生成 .output 目录）
RUN npm run build:docker


# 运行时层
FROM node:22-alpine

# 设置工作目录
WORKDIR /app

COPY --from=build-env /app/.output .output

# 暴露端口
EXPOSE 3000

# 设置环境变量：生产模式，监听所有接口
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production

# 启动命令：运行 Nitro 生成的服务器
ENTRYPOINT ["node", ".output/server/index.mjs"]
