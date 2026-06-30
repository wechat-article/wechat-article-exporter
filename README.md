# WeChat Article Exporter (魔改版)

本项目是基于原 `wechat-article-exporter` 的深度定制魔改版本，旨在将原本“纯浏览器端运行”的同步与下载任务，完全转移到 **云服务器后台进行异步处理**。

## 🌟 魔改特性

1. **服务器后台云同步**：点击同步后，任务在服务器后台异步拉取，即使关闭浏览器网页也绝不中断。
2. **服务器后台云下载**：支持将文章以 **Markdown (`.md`)** 格式直接下载至服务器本机的指定目录。
3. **插图本地化保存**：下载时会自动爬取文章的所有插图，归档在本地 assets 目录下，并自动将 Markdown 中的图片源改写为本地相对路径，完美适配离线阅读器（如 Obsidian、Typora 等）。
4. **进度自动双向同步**：服务器的下载状态会自动同步并写回浏览器的 IndexedDB 缓存中，网页表格上的“内容已下载”复选框会随着服务器下载进度自动实时勾选。

---

## 📂 文件夹位置说明

下载与元数据均存放在宿主机的当前工作目录 `/home/科技公众号趋势研究` 下：

| 目录路径 | 作用 | 说明 |
| :--- | :--- | :--- |
| **`dataset/<公众号名>/<年月>/`** | **离线文章存储目录** | 存放导出的 `.md` 文章，命名格式为 `<文章标题>-<发布时间>.md` |
| `dataset/<公众号名>/<年月>/assets/` | **文章图片存储目录** | 存放该月下所有文章本地化保存的插图资源 |
| `.meta/<公众号名>/` | **服务器任务元数据** | 存放微信文章目录 `articles.json` 和已下载 URL 列表 `downloaded.json` |
| `wechat-exporter-data/` | **微信登录 Session 目录** | 用于持久化您扫码登录微信公众号后的加密登录凭证与 Cookie |

---

## 🚀 运行与部署说明

### 1. 运行管理 (Systemd)

我们在服务器上配置了 `systemd` 服务，以便于开机自启和后台生命周期管理：

* **启动服务**：`systemctl start wechat-exporter.service`
* **停止服务**：`systemctl stop wechat-exporter.service`
* **重启服务**：`systemctl restart wechat-exporter.service`
* **查看状态**：`systemctl status wechat-exporter.service`

### 2. 容器编译 (Docker)

如需对代码进行改动，请在项目根目录下执行以下步骤重新打包和部署：

```bash
# 1. 编译本地镜像 (已设置 NODE_OPTIONS 防止 Vite 编译 OOM)
DOCKER_BUILDKIT=0 docker build -t wechat-article-exporter-local:latest .

# 2. 重启 Systemd 服务（会自动停止旧容器并应用新镜像运行）
systemctl restart wechat-exporter.service
```

### 3. Nginx 反向代理配置

项目在云服务器上通过 Nginx 进行反向代理并启用 HTTPS 访问：
* **反向代理访问路径**：`https://llinker.com/wechat-exporter/`
* **Nginx 配置要点**：
  * 对 `location /wechat-exporter/` 配置 WebSocket 升级头支持。
  * 对 `location /vendors/` 配置静态依赖转发。
  * 对 `location /api/web/` 和 `location /api/v1/` 配置接口重映射（映射至容器内部的子路径 `/wechat-exporter/api/...`）。

---

## 🔌 开放的 API 接口说明

魔改版在服务器端开放了完整的控制与查询接口，所有接口都能够直接支持跨域或通过 Nginx 进行代理请求：

### 1. 触发云同步
* **接口**：`POST /api/web/task/sync`
* **请求头**：需要包含有效的 `auth-key` Cookie 或者 `X-Auth-Key` Header。
* **参数**：
  ```json
  {
    "fakeid": "MzI3MTA0MTk1MA==",
    "nickname": "新智元"
  }
  ```
* **说明**：触发微信文章列表的后台异步抓取，数据将被合并保存至 `.meta/<公众号名>/articles.json`。

### 2. 触发云下载
* **接口**：`POST /api/web/task/download`
* **参数**：
  ```json
  {
    "fakeid": "MzI3MTA0MTk1MA==",
    "nickname": "新智元",
    "proxyUrl": "https://young-poetry-77dd.megagimen.workers.dev",
    "articles": [] 
  }
  ```
* **参数说明**：`articles` 参数可选。如果传入特定文章数组，服务器将只下载数组中的文章；如果不传，服务器将默认异步下载 `.meta/<公众号名>/articles.json` 中的全部文章。

### 3. 查询任务运行进度
* **接口**：`GET /api/web/task/status?fakeid=xxx`
* **返回示例**：
  ```json
  {
    "sync": {
      "status": "running", // running | completed | failed | idle
      "progress": 691,
      "total": 5671
    },
    "download": {
      "status": "idle",
      "progress": 0,
      "total": 0
    }
  }
  ```

### 4. 获取已下载 URL 列表
* **接口**：`GET /api/web/task/downloaded?nickname=xxx`
* **返回**：已成功被云下载的微信文章 URL 数组，如 `["https://mp.weixin.qq.com/s/...", ...]`。

### 5. 获取全部同步文章元数据
* **接口**：`GET /api/web/task/articles?nickname=xxx`
* **返回**：`.meta` 下保存的 `articles.json` 的全部文章数据数组。
