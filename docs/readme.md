# 数据的存储与查询

## 登录

经过一系列扫码操作之后，登录接口返回如下结构(内含`token`)表示登录成功：

```json
{
  "uuid": "c5c5d4a6-764c-4927-9af7-4af026878121",
  "nickname": "板板0305",
  "avatar": "http://mmbiz.qpic.cn/sz_mmbiz_png/vg6teTpsRkTUMruvX2ECW7MPmqND4vno2KRJAz6FREElS7ggKhcnHNrLTw7Wxs6e8icUQWtjpE28xziar36HXHEQ/0?wx_fmt=png",
  "fakeid": "Mzk1NzcyMDc0OA==",
  "token": "1211895474",
  "expires": "sun, 09-mar-2025 14:16:45 gmt"
}
```

并将该结果保存在具有响应式的 LocalStorage `login`中。

> 后续考虑是否优化一下 key 的名称

同时，如果`account`响应式 LocalStorage 中没有值的话，就将当前登录的账号设置进去，如下所示：

> 该值表示当前首页正在搜索的公众号

```js
activeAccount.value = {
    type: 'account',
    fakeid: result.fakeid,
    nickname: result.nickname,
    round_head_img: result.avatar,
    service_type: 1,
    alias: '',
    signature: '',
};
```

## 设置

> 后面考虑将所有设置项统一管理

### 1. Credentials

`Credentials`数据保存在 LocalStorage 的 `credentials` 中，非响应式，结构如下：

```json
{
  "__biz": "",
  "uin": "",
  "key": "",
  "pass_ticket": "",
  "wap_sid2": "",
  "updatedAt": ""
}
```

### 2. 私有代理

私有代理数据保存在 LocalStorage 的 `wechat-proxy` 中，非响应式，结构如下：

```json
[
  "https://wproxy-01.deno.dev/",
  "https://wproxy-02.deno.dev/",
  "https://wproxy-03.deno.dev/"
]
```

### 3. 下载选项

暂未存储

### 4. 其他

暂未存储

## 搜索公众号

搜索到的公众号列表数据并不进行缓存，因为发生的频次较低。
但是选中某个公众号时，会将该公众号信息保存在响应式的 `account` LocalStorage 中。

账号数据结构如下：

```json
{
  "fakeid": "MzU2MTIyNDUwMA==",
  "nickname": "前端充电宝",
  "alias": "FE-Charge",
  "round_head_img": "http://mmbiz.qpic.cn/mmbiz_png/EO58xpw5UMOQ7SLUFBoTAic22Pd63GqfXZibppZSGia2DsCllsnZrhZZqFN0ucxmztqP0icicOEiaQKAIAvnF71lqT4w/0?wx_fmt=png",
  "service_type": 1,
  "signature": "聚焦前端开发，探索AI新浪潮：宝藏工具×前沿动态×实战技巧，解锁前端新可能！"
}
```

## 缓存文章列表

每次调用获取文章列表接口都会自动将获取到的文章列表数据写入`article`仓库中。

该仓库的 key 为`${fakeid}:${article.aid}`的形式，value 为对应的文章对象`AppMsgEx`，因此支持多次写入/更新操作。

每次将文章列表数据写入`article`仓库时，同时会将统计数据写入`info`仓库中。
这两个仓库是实时同步的关系。

`info`仓库中的`articles`字段表示该公众号已缓存的文章数，`count`字段表示该公众号已缓存的消息数。
注意这两个值的区别：微信公众号中一条消息可以包含多篇文章，所以存在`articles >= count`的关系。
`completed`字段则表示是否将该公众号最早的一篇文章缓存完毕

### 加载已缓存文章

> `article`和`info`仓库在这里起到了重要作用。

每次调用完获取文章列表接口(会自动进行缓存)之后，都会检查是否存在可用缓存，具体如何判断是否存在可用缓存呢？

我们取接口返回的最早的一篇文章(`articles.at(-1)`，最后的一篇应该就是最早的一篇)，检查`articles`仓库中是否存在比这篇文章更早的文章，如果存在，则说明存在可用的缓存(因为历史文章是不可更改的，可以安全的从缓存中进行加载)。

这里就需要使用`articles`仓库上的`fakeid_create_time`索引来根据文章的`create_time`字段进行检索。核心代码如下：

```js
// 检查是否存在比 create_time 更早的文章
const index = db.transaction('article').objectStore('article').index('fakeid_create_time');
const range = IDBKeyRange.bound([fakeid], [fakeid, create_time], false, true);
const request = index.openCursor(range);
```

如果存在缓存，我们应该如何加载呢？也就是说我们把缓存中的所有可用缓存都加载出来后，后续该怎么继续查询呢？

我们通过以下代码查询出所有可用缓存：

```js
const range = IDBKeyRange.bound([fakeid], [fakeid, create_time], false, true);
const request = index.openCursor(range, 'prev');
```

然后更新下次查询的`begin`参数：

```js
const count = articles.filter(article => article.itemidx === 1).length;
begin.value += count;
```

## 导出时的查询

### 文章菜单下公众号下拉列表的数据

从`info`仓库中读取所有缓存过的公众号信息，并按照`articles`字段从大到小排序，查询出的结构如下：

```json
[
  {
    "fakeid": "",
    "articles": 10,
    "count": 10,
    "completed": false,
    "nickname": "板板",
    "round_head_img": "https://xxx"
  },
  {
    "fakeid": "",
    "articles": 5,
    "count": 5,
    "completed": false,
    "nickname": "板板",
    "round_head_img": "https://xxx"
  }
]
```

### 文章列表数据

从`articles`仓库中读取指定公众号的所有缓存文章。

### 合集菜单下公众号下拉列表的数据

先从`info`仓库中获取所有缓存过的公众号列表，然后计算每个公众号下有多少合集，并保存在`albums`字段中，并按照该字段的长度从大到小排序，最终的结构如下：

```json
[
  {
    "fakeid": "",
    "articles": 10,
    "count": 10,
    "completed": false,
    "nickname": "板板",
    "round_head_img": "https://xxx",
    "albums": []
  },
  {
    "fakeid": "",
    "articles": 5,
    "count": 5,
    "completed": false,
    "nickname": "板板",
    "round_head_img": "https://xxx",
    "albums": []
  }
]
```

合集的计算方法如下：

> 从该公众号所有已缓存的文章中提取

```ts
// 获取公众号下所有的合集数据（根据已缓存的文章数据）
async function getAllAlbums(fakeid: string) {
  const articles = await getArticleCache(fakeid, Date.now());
  const albums: AppMsgAlbumInfo[] = [];
  articles
    .flatMap(article => article.appmsg_album_infos)
    .forEach(album => {
      if (!albums.some(a => a.id === album.id)) {
        albums.push(album);
      }
    });

  return albums;
}
```
