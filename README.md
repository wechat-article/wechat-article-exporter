# exporter

## 后续优化点

### 1. 导出 PDF 格式

本地需要起一个 https://pptr.dev/ 服务，然后网页与该服务建立 ws 连接，调用该服务，将 html 格式转为 pdf / image / md 等格式。
连接并使用该服务之前需要进行认证，防止被恶意网站利用。

如果不想起服务的话，下载的格式为 html，就需要单独的本地工具处理上面的转换。


### 2. 公共代理优化

公共代理部署在 CF 中，通过 IP 白名单进行访问，在设置页面用户最多可设置3个IP白名单，通过 CF 提供的 API 设置到 WAF 中，如下所示：

```shell
curl -X POST \
   "https://api.cloudflare.com/client/v4/zones/88fdc453fd7fcd34dc11c3dcc4a4b39b/rulesets/171f833bf3e0423d9b731137a0b43970/rules" \
   -H "Authorization: Bearer $CF_AUTH_TOKEN" \
   -d '{
    "description": "IP白名单",
    "expression": "(not ip.src in {192.10.10.1 232.2.1.3})",
    "action": "block",
    "position": {
        "index": 1
    }
}'
```

## Docker

```shell
docker tag [local_image_id] dockerhub_username/repository_name:tag
docker push dockerhub_username/repository_name:tag
```
