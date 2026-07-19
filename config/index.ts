import dayjs from 'dayjs';

/**
 * 是否在开发环境
 */
export const isDev = process.env.NODE_ENV === 'development';

/**
 * 网站标题
 */
export const websiteName = '公众号文章导出';

/**
 * 文章列表每页大小，20为最大有效值
 */
export const ARTICLE_LIST_PAGE_SIZE = 20;

/**
 * 公众号列表每页大小
 */
export const ACCOUNT_LIST_PAGE_SIZE = 5;

/**
 * 公众号类型
 */
export const ACCOUNT_TYPE: Record<number, string> = {
  0: '订阅号',
  1: '订阅号',
  2: '服务号',
};

/**
 * Credentials 生存时间，单位：分钟
 */
export const CREDENTIAL_LIVE_MINUTES: number = 25;

/**
 * Credentials 服务器主机地址
 */
export const CREDENTIAL_API_HOST = 'http://127.0.0.1:8088';

/**
 * 文档站点地址
 */
export const docsWebSite = 'https://docs.mptext.top';

// 图片代理服务 todo: 这个可以在设置里增加一个配置项，网站是否启用图片代理，否的话置空即可。相应的，可以与 no-referer 配置互斥。
// export const IMAGE_PROXY = 'https://image.baidu.com/search/down?thumburl=';
export const IMAGE_PROXY = '';

/**
 * 转发微信公众号请求时，使用的 user-agent 字符串
 */
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 WAE/1.0';

/**
 * 微信公众号上线时间 2012-08-23
 */
export const MP_ORIGIN_TIMESTAMP = dayjs('2012-08-23 00:00:00').unix();

/**
 * 文章显示类型
 */
export const ITEM_SHOW_TYPE: Record<number, string> = {
  0: '普通图文',
  5: '视频分享',
  6: '音乐分享',
  7: '音频分享',
  8: '图片分享',
  10: '文本分享',
  11: '文章分享',
  17: '短文',
};

/**
 * 外部接口服务
 * STATUS：cf-worker 状态类接口，由 cron.mptext.top 提供
 */
export const STATUS_API_SERVICE = 'https://cron.mptext.top';
