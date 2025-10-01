# 缓存数据库设计

> 数据库名: `wechat-article-exporter`
> 
> 当前版本号: 4


## version: 1

### `article` store

用于存储文章列表接口拉取过的文章数据，减少接口请求次数。

数据结构如下:

```ts
import {AppMsgEx} from "../types";

declare const article: AppMsgEx


// key 采用【公众号id】与【文章id】组合的形式
const key = `${fakeid}:${article.aid}`

// value 除了文章相关字段外，增加了 fakeid 字段
type StoreObjectValue = AppMsgEx & {
    fakeid: string
}
```

需要的索引:

- fakeid
- create_time (废弃，后续版本删除)
- fakeid_create_time (`fakeid`与`create_time`的复合索引)


### `info` store

用于统计公众号已缓存信息。

对象数据结构如下:

```ts
interface Info {
    /**
     * 公众号id (keyPath)
     */
    fakeid: string
    
    /**
     * 文章是否已全部加载
     * 
     * 公众号文章的加载逻辑是从最新的文章开始往前加载，越早的文章越靠后
     */
    completed: boolean

    /**
     * 缓存的消息数
     * 
     * 一条消息可能会包含多篇文章
     * 分页查询采用的是消息条数，而不是文章条数
     */
    count: number

    /**
     * 缓存的文章数
     */
    articles: number
}
```

### `asset` store

用于存储 css 文件，因为大部分文章的样式文件都相同，所以缓存该文件对于减少下载速度有重要意义。

对象数据结构如下:

```ts
interface Asset {
    /**
     * css文件路径 (keyPath)
     */
    url: string

    /**
     * 文件对象
     */
    file: File
}
```


## version: 2

### `api` store

用于统计接口调用情况，帮助分析微信接口频率限制规则。

该项目涉及到的可能会被微信限制调用频率的有如下接口:

- `/api/searchbiz` 公众号列表 (调用频次相对较低，不容易出现限制)
- `/api/appmsgpublish` 历史文章列表 (调用频次高，很容易出现限频)
- `/api/获取评论` 附带微信用户信息
- `/api/获取阅读量` 附带微信用户信息

### 注意

1. 文章下载不涉及到微信接口调用，因为文章链接是公开可访问的，不需要携带cookie
2. 即使`/api/appmsgpublish`接口被限频，仍可以通过带关键字进行调用


对象数据结构如下:

```ts
type ApiName = 'searchbiz' | 'appmsgpublish'


interface APICall {
    /**
     * 接口名称
     */
    name: ApiName

    /**
     * 调用账号(nickname)
     */
    account: string

    /**
     * 调用时间
     */
    call_time: number

    /**
     * 调用结果是否正常
     * 
     * true: 正常
     * false: 被封禁
     */
    is_normal: boolean

    /**
     * 请求参数
     */
    payload: Record<string, any>
}
```

需要的索引:

- account
- account_call_time (`account`与`call_time`的复合索引)


## version: 3

### `proxy` store

> 不再统计该数据，后续版本进行删除

用于统计代理使用情况。

对象数据结构如下:

```ts
interface Proxy {
    // 代理地址 (keyPath)
    address: string

    // 是否正在被使用
    busy: boolean

    // 是否处于冷静期
    cooldown: boolean

    // 使用次数
    usageCount: number

    // 成功次数
    successCount: number

    // 失败次数
    failureCount: number

    // 下载流量
    traffic: number
}
```

## version: 4

### `download` store

> 废弃


## version: 5

### `html` store

文章对应的 html 文件

数据结构如下：
```ts
interface ArticleFile {
  // html 文章地址 (keyPath)
  url: string
  
  // html 文章内容
  file: Blob
  
  // 文章标题
  title: string

  // 评论ID，用于获取评论
  commentID: string | null;
}
```

### `resource` store

文章内资源文件

数据结构如下：
```ts
interface Resource {
  // 资源url (keyPath)
  url: string
  
  // 资源文件
  file: File
}
```

### `resource-map` store

文章资源文件关系

数据结构如下：
```ts
interface ResourceMap {
  // 文章地址 (keyPath)
  url: string
  
  // 资源地址
  resources: string[]
}
```

### `comment` store

评论表

对象数据结构如下：
```ts
interface Comment {
  // 文章地址 (keyPath)
  url: string

  // 文章标题
  title: string
  
  // 评论数据
  data: any
}
```

### `metadata` store

文章的阅读、点赞、分享、喜欢、留言等数据

数据结构如下：
```ts
interface MetaData {
  // 文章url (keyPath)
  url: string
  
  // 文章标题
  title: string

  // 阅读
  readNum: number;

  // 点赞
  oldLikeNum: number;

  // 分享
  shareNum: number;

  // 喜欢
  likeNum: number;

  // 留言
  commentNum: number;
}
```

### `debug` store

用于调试

数据结构如下：
```ts
interface HtmlAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
}
```
