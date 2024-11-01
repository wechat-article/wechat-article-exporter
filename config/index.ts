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
 * 代理池
 */
export const AVAILABLE_PROXY_LIST: string[] = [
    // 'https://vproxy-01.deno.dev/',
    // 'https://vproxy-02.deno.dev/',
    // 'https://vproxy-03.deno.dev/',
    // 'https://vproxy-04.deno.dev/',
    // 'https://vproxy-05.deno.dev/',
    // 'https://vproxy-06.deno.dev/',
    // 'https://vproxy-07.deno.dev/',
    // 'https://vproxy-08.deno.dev/',
    // 'https://vproxy-09.deno.dev/',
    // 'https://vproxy-10.deno.dev/',
    // 'https://vproxy-11.deno.dev/',
    // 'https://vproxy-12.deno.dev/',
    // 'https://vproxy-13.deno.dev/',
    // 'https://vproxy-14.deno.dev/',
    // 'https://vproxy-15.deno.dev/',
    // 'https://vproxy-16.deno.dev/',
    // 'https://vproxy-01.jooooock.workers.dev/',
    // 'https://vproxy-02.jooooock.workers.dev/',
    https://deno-proxy-20.deno.dev/
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
