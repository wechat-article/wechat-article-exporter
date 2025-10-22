export const isDev = !import.meta.env.PROD;

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
 * 公共代理
 */
export const PUBLIC_PROXY_LIST: string[] = [
  'https://00.workers-proxy.top',
  'https://01.workers-proxy.top',
  'https://02.workers-proxy.top',
  'https://03.workers-proxy.top',
  'https://04.workers-proxy.top',
  'https://05.workers-proxy.top',
  'https://06.workers-proxy.top',
  'https://07.workers-proxy.top',
  'https://08.workers-proxy.top',
  'https://09.workers-proxy.top',
  'https://10.workers-proxy.top',
  'https://11.workers-proxy.top',
  'https://12.workers-proxy.top',
  'https://13.workers-proxy.top',
  'https://14.workers-proxy.top',
  'https://15.workers-proxy.top',

  'https://00.workers-proxy.ggff.net',
  'https://01.workers-proxy.ggff.net',
  'https://02.workers-proxy.ggff.net',
  'https://03.workers-proxy.ggff.net',
  'https://04.workers-proxy.ggff.net',
  'https://05.workers-proxy.ggff.net',
  'https://06.workers-proxy.ggff.net',
  'https://07.workers-proxy.ggff.net',
  'https://08.workers-proxy.ggff.net',
  'https://09.workers-proxy.ggff.net',
  'https://10.workers-proxy.ggff.net',
  'https://11.workers-proxy.ggff.net',
  'https://12.workers-proxy.ggff.net',
  'https://13.workers-proxy.ggff.net',
  'https://14.workers-proxy.ggff.net',
  'https://15.workers-proxy.ggff.net',
];

/**
 * 扫码状态
 */
const SCAN_LOGIN_TYPE = {
  0: '等待扫码',
  1: '扫码成功，可登录账号=1',
  2: '扫码成功，可登录账号>1',
  3: '没有可登录账号',
  4: '登录失败',
  5: '二维码已过期',
  6: '二维码加载失败',
  7: 'qq号需要绑定邮箱',
};

/**
 * Credentials 生存时间，单位：分钟
 */
export const CREDENTIAL_LIVE_MINUTES: number = 25;

/**
 * Credentials 服务器主机地址
 */
export const CREDENTIAL_API_HOST = 'http://127.0.0.1:8088';

// 文档站点地址
export const docsWebSite = 'https://docs.wxdown.online';

export const apis = [
  {
    name: '搜索公众号',
    description: '根据公众号名称或关键字查询公众号列表。',
    url: '/api/public/v1/account',
    method: 'GET',
    params: [
      {
        label: '关键字',
        name: 'keyword',
        location: 'query',
        required: true,
        default: 'N/A',
        type: 'String',
        remark: '',
      },
      {
        label: '起始索引',
        name: 'begin',
        location: 'query',
        required: false,
        default: '0',
        type: 'Int',
        remark: '下标从0开始，不能为负',
      },
      {
        label: '返回条数',
        name: 'size',
        location: 'query',
        required: false,
        default: '5',
        type: 'Int',
        remark: '最大不得超过20',
      },
    ],
    responseSample: {
      base_resp: {
        ret: 0,
        err_msg: 'ok',
      },
      total: 2,
      list: [
        {
          fakeid: 'MzA3NzAyMzMyMA==',
          nickname: '铁路12306',
          alias: 'CRTT12306',
          round_head_img:
            'http://mmbiz.qpic.cn/mmbiz_png/1774PicJv1ocOBxUD1Kh8gqx6HmD105nGnCg4j84mw4gxtmgsbgaVbiaOq6fCgVpHjwjELnMTGV8IR6kq7XJNkdw/0?wx_fmt=png',
          service_type: 2,
          signature: '欢迎您关注铁路12306，我们竭诚为您提供火车票、畅行会员、列车餐饮、酒店预订、旅游等服务。',
          verify_status: 2,
        },
        {
          fakeid: 'MjM5NTM0Mzg0MA==',
          nickname: '12321受理中心',
          alias: 'zg12321jbzx',
          round_head_img:
            'http://mmbiz.qpic.cn/mmbiz_png/b6geF0mDiaH4E82KiagmLc2DiaPrvzbSaELEde0xfZXrmcUzdBjK2G0ME4U1rwCvk0ZmtUsOncAkpnYTNoyDfhx6A/0?wx_fmt=png',
          service_type: 2,
          signature: ' ',
          verify_status: 2,
        },
      ],
    },
  },
  {
    name: '获取文章列表',
    description: '获取公众号的历史文章列表',
    url: '/api/public/v1/article',
    method: 'GET',
    params: [
      {
        label: '公众号id',
        name: 'fakeid',
        location: 'query',
        required: true,
        default: 'N/A',
        type: 'String',
        remark: '',
      },
      {
        label: '起始索引',
        name: 'begin',
        location: 'query',
        required: false,
        default: '0',
        type: 'Int',
        remark: '下标从0开始，不能为负',
      },
      {
        label: '返回消息条数',
        name: 'size',
        location: 'query',
        required: false,
        default: '5',
        type: 'Int',
        remark: '最大不得超过20，一条消息可能会包含多篇文章',
      },
    ],
    responseSample: {
      base_resp: {
        err_msg: 'ok',
        ret: 0,
      },
      articles: [
        {
          aid: '2247503214_1',
          title: '我用ChatGPT AI Agent做了一个堆栈模拟器！',
          cover:
            'https://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYXdb3LgmxYMRclBo2wibeyib4MFwhyI3mWQ6dwZOKvCXWibCXVLnr9e0rTUf9IzZn3LPDQBlEwXzyJ8Q/0?wx_fmt=jpeg',
          link: 'https://mp.weixin.qq.com/s/wZxawrdSdSUAAZc89XuhWg',
          digest: '',
          update_time: 1753666492,
          appmsgid: 2247503214,
          itemidx: 1,
          item_show_type: 0,
          author_name: '轩辕之风',
          tagid: [],
          create_time: 1753666493,
          is_pay_subscribe: 0,
          has_red_packet_cover: 0,
          album_id: '3457885223537541125',
          checking: 0,
          media_duration: '0:00',
          mediaapi_publish_status: 0,
          copyright_type: 1,
          appmsg_album_infos: [
            {
              id: '3457885223537541125',
              title: '人工智能',
              album_id: 3457885223537541000,
              appmsg_album_infos: [],
              tagSource: 0,
            },
          ],
          pay_album_info: {
            appmsg_album_infos: [],
          },
          is_deleted: false,
          ban_flag: 0,
          pic_cdn_url_235_1:
            'https://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYXdb3LgmxYMRclBo2wibeyib4V7nwzMbwLYKbgFSSbnQt0rUmdz1XcSE33YFzfqpVrYNKD8DagbnPRw/0?wx_fmt=jpeg',
          pic_cdn_url_16_9: '',
          pic_cdn_url_3_4: '',
          pic_cdn_url_1_1:
            'https://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYXdb3LgmxYMRclBo2wibeyib4MFwhyI3mWQ6dwZOKvCXWibCXVLnr9e0rTUf9IzZn3LPDQBlEwXzyJ8Q/0?wx_fmt=jpeg',
          cover_img:
            'http://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYXdb3LgmxYMRclBo2wibeyib4MFwhyI3mWQ6dwZOKvCXWibCXVLnr9e0rTUf9IzZn3LPDQBlEwXzyJ8Q/0?wx_fmt=jpeg',
          cover_img_theme_color: {
            r: 255,
            g: 255,
            b: 255,
          },
          line_info: {
            use_line: 1,
            line_count: 0,
            is_appmsg_flag: 1,
            is_use_flag: 0,
          },
          copyright_stat: 1,
          is_rumor_refutation: 0,
          multi_picture_cover: 0,
          share_imageinfo: [],
        },
        {
          aid: '2247503179_1',
          title: '抖音C++安全开发面试题，已阵亡！',
          cover:
            'https://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYUYIgV3fNdQyKIysEER6tQZCpgfTrYwfKX67eRWicg9TIciadwXJF9QMhUiaLaR4iabdwdiaib7FmWY62eg/0?wx_fmt=jpeg',
          link: 'https://mp.weixin.qq.com/s/eFsIOWDXfs9DbcNmr2vtjQ',
          digest: '',
          update_time: 1753230604,
          appmsgid: 2247503179,
          itemidx: 1,
          item_show_type: 0,
          author_name: '轩辕之风',
          tagid: [],
          create_time: 1753230605,
          is_pay_subscribe: 0,
          has_red_packet_cover: 0,
          album_id: '3560766261049098241',
          checking: 0,
          media_duration: '0:00',
          mediaapi_publish_status: 0,
          copyright_type: 1,
          appmsg_album_infos: [
            {
              id: '3560766261049098241',
              title: 'C/C++',
              album_id: 3560766261049098000,
              appmsg_album_infos: [],
              tagSource: 0,
            },
          ],
          pay_album_info: {
            appmsg_album_infos: [],
          },
          is_deleted: false,
          ban_flag: 0,
          pic_cdn_url_235_1:
            'https://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYUYIgV3fNdQyKIysEER6tQZuuUaqiazzPPoUFqFWicZ7bsW8z6g9FhkbibyqRtfZwRAkFHhPIydWpLnQ/0?wx_fmt=jpeg',
          pic_cdn_url_16_9: '',
          pic_cdn_url_3_4: '',
          pic_cdn_url_1_1:
            'https://mmbiz.qpic.cn/mmbiz_jpg/jXQDbLkGBYUYIgV3fNdQyKIysEER6tQZCpgfTrYwfKX67eRWicg9TIciadwXJF9QMhUiaLaR4iabdwdiaib7FmWY62eg/0?wx_fmt=jpeg',
          line_info: {
            use_line: 1,
            line_count: 0,
            is_appmsg_flag: 1,
            is_use_flag: 0,
          },
          copyright_stat: 1,
          is_rumor_refutation: 0,
          multi_picture_cover: 0,
          share_imageinfo: [],
        },
      ],
    },
  },
  {
    name: '获取文章内容 (开发中)',
    description: '获取文章内容，支持 html / markdown / text 格式',
    url: '/api/public/v1/download',
    method: 'GET',
    params: [
      {
        label: '文章链接',
        name: 'url',
        location: 'query',
        required: true,
        default: 'N/A',
        type: 'String',
        remark: '需经过url编码',
      },
      {
        label: '输出格式',
        name: 'format',
        location: 'query',
        required: false,
        default: 'html',
        type: 'String',
        remark: '支持 html / markdown / text 格式',
      },
    ],
    responseSample: {},
  },
];


// 图片代理服务 todo: 这个可以在设置里增加一个配置项，网站是否启用图片代理，否的话置空即可。相应的，可以与 no-referer 配置互斥。
// export const IMAGE_PROXY = 'https://image.baidu.com/search/down?thumburl=';
export const IMAGE_PROXY = '';

// 转发微信公众号请求时，使用的 user-agent 字符串
export const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36 Wae/1.0';
