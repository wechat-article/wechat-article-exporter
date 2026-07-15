# wechat-article-exporter

![GitHub stars]
![GitHub forks]
![GitHub License]
![Package Version]


一款在线的 **微信公众号文章批量下载** 工具，支持导出阅读量与评论数据，无需搭建任何环境，可通过 [在线网站] 使用，同时也支持 docker 私有化部署和 Cloudflare 部署。

支持下载各种文件格式，其中 HTML 格式可100%还原文章排版与样式。

交流群(QQ):
- `494723496`


## :books: 如何使用？

该工具的使用教程已移至 [文档站点](https://docs.mptext.top)。


## :dart: 特性

- [x] 搜索公众号，支持关键字搜索
- [x] 支持导出 html/json/excel/txt/md/docx 格式(html 格式打包了图片和样式文件，能够保证100%还原文章样式)
- [x] 缓存文章列表数据，减少接口请求次数
- [x] 支持文章过滤，包括作者、标题、发布时间、原创标识、所属合集等
- [x] 支持合集下载
- [x] 支持图片分享消息
- [x] 支持视频分享消息
- [x] 支持导出评论、评论回复、阅读量、转发量等数据 (需要抓包获取 credentials 信息，[查看操作步骤](https://docs.mptext.top/advanced/wxdown-service.html))
- [x] 支持 Docker 部署
- [x] 支持 Cloudflare 部署
- [x] 开放 API 接口


## 稳定使用

**不想每日抢代理额度，也不想折腾代理节点？更想要稳定、省心的开箱体验？**

试试本项目的商业版 —— **[公号三刀](https://wechat.zoro.build)**

|           | 本项目                         | 公号三刀                                        |
|-----------|-----------------------------|---------------------------------------------|
| 价格        | 完全开源、免费自用                   | 付费使用（7天免费体验，与付费用户功能一致）                      |
| 抓取通道      | 依赖公共代理节点，**每天额度有限、需要"抢额度"** | **由我们维护，开箱即用，不限抓取额度**；网络受限时还可**一键填入自建节点**兜底 |
| 稳定性       | 功能相对有限、可能存在 bug             | 更稳定、功能更丰富，更新更频繁                             |
| 抓取阅读量/评论  | 可以，需手动配置 wxdown 程序          | 无需配置外部程序，软件内集成抓包工具，体验更丝滑                    |
| 导出 PDF 格式 | 线上网站不支持，本地运行支持              | 支持                                          |
| 免扫码登录     | 不支持                         | 支持                                          |
| 多账号切换     | 不支持                         | 支持                                          |
| RSS       | 不支持                         | 支持                                          |
| API       | 支持                          | 暂不支持                                        |
| 适合谁       | 愿意自己折腾、动手能力强的用户             | 希望"打开就能用"的普通用户                              |

如果你喜欢折腾、想完全免费自托管，欢迎使用开源版(本项目)；如果你想省心稳定、不想被代理额度卡住，公号三刀帮你把这些麻烦都解决了。



## :heart: 感谢

- 感谢 [Deno Deploy]、[Cloudflare Workers] 提供免费托管服务
- 感谢 [WeChat_Article] 项目提供原理思路


## :star: 支持

如果你觉得本项目帮助到了你，请给作者一个免费的 Star，感谢你的支持！


## :bulb: 原理

在公众号后台写文章时支持搜索其他公众号的文章功能，以此来实现抓取指定公众号所有文章的目的。


## :memo: 许可

MIT

## :red_circle: 声明

本程序承诺，不会利用您扫码登录的公众号进行任何形式的私有爬虫，也就是说不存在把你的账号作为公共账号为别人爬取文章的行为，也不存在类似账号池的东西。

您的公众号只会服务于您自己的抓取文章的目的。

通过本程序获取的公众号文章内容，版权归文章原作者所有，请合理使用。若发现侵权行为，请联系我们处理。


## :chart_with_upwards_trend: Star 历史

[![Star History Chart]][Star History Chart Link]



<!-- Definitions -->

[GitHub stars]: https://img.shields.io/github/stars/wechat-article/wechat-article-exporter?style=social&label=Star&style=plastic

[GitHub forks]: https://img.shields.io/github/forks/wechat-article/wechat-article-exporter?style=social&label=Fork&style=plastic

[GitHub License]: https://img.shields.io/github/license/wechat-article/wechat-article-exporter?label=License

[Package Version]: https://img.shields.io/github/package-json/v/wechat-article/wechat-article-exporter


[Deno Deploy]: https://deno.com/deploy

[Cloudflare Workers]: https://workers.cloudflare.com

[Wechat_Article]: https://github.com/1061700625/WeChat_Article

[Star History Chart]: https://api.star-history.com/svg?repos=wechat-article/wechat-article-exporter&type=Timeline

[Star History Chart Link]: https://star-history.com/#wechat-article/wechat-article-exporter&Timeline

[在线网站]: https://down.mptext.top
