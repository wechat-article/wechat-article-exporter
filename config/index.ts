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
    2: '服务号'
}

/**
 * 公共代理
 */
export const AVAILABLE_PROXY_LIST: string[] = [
    'https://00.workers-proxy.top/',
    'https://01.workers-proxy.top/',
    'https://02.workers-proxy.top/',
    'https://03.workers-proxy.top/',
    'https://04.workers-proxy.top/',
    'https://05.workers-proxy.top/',
    'https://06.workers-proxy.top/',
    'https://07.workers-proxy.top/',
    'https://08.workers-proxy.top/',
    'https://09.workers-proxy.top/',
    'https://11.workers-proxy.top/',
    'https://12.workers-proxy.top/',
    'https://13.workers-proxy.top/',
    'https://14.workers-proxy.top/',
    'https://15.workers-proxy.top/',
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
]


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
}
