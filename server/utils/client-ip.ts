import { H3Event } from 'h3';

/**
 * 获取客户端真实 IP
 *
 * @description 优先使用 Cloudflare 注入的 `CF-Connecting-IP`（单一真实客户端 IP，
 * 不像 x-forwarded-for 可被追加伪造），回退到 x-forwarded-for / socket。
 * 可运行在 Cloudflare Workers 与 Node（Docker）环境。
 */
export function getClientIp(event: H3Event): string {
  const req = event.node.req;

  // Cloudflare 注入的真实客户端 IP（最高优先级）
  let ip: string | string[] | undefined = req.headers['cf-connecting-ip'];

  // 回退 x-forwarded-for（常见于代理 / Nginx / Cloudflare）
  if (!ip) {
    ip = req.headers['x-forwarded-for'] || '';
  }

  // x-forwarded-for 可能是字符串或数组，也可能包含多个 IP
  if (Array.isArray(ip)) {
    ip = ip[0];
  }
  if (typeof ip === 'string') {
    ip = ip.split(',')[0]?.trim() ?? '';
  }

  // 回退到 socket / connection 的 remoteAddress
  if (!ip) {
    ip = req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  }

  // 处理 IPv6 映射的 IPv4 地址（本地开发常见 ::ffff:127.0.0.1）
  if (typeof ip === 'string' && ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }

  return (typeof ip === 'string' && ip) || 'unknown';
}
