import { H3Event } from 'h3';
import { lookupMember } from '~/server/kv/member';
import { getClientIp } from '~/server/utils/client-ip';

// Cloudflare Rate Limiting 绑定的最小接口（见 wrangler.toml 的 [[ratelimits]]）
interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface RateLimitEnv {
  RL_GUEST_QUERY?: RateLimiter;
  RL_MEMBER_QUERY?: RateLimiter;
  RL_GUEST_DOWNLOAD?: RateLimiter;
  RL_MEMBER_DOWNLOAD?: RateLimiter;
}

// 限流分组：查询类（前 3 个接口）与下载类（第 4 个接口），游客/会员限额不同。
export type RateGroup = 'query' | 'download';

// 身份判定结果：供接口做进一步的会员专属能力控制（如仅会员可导出 json/markdown/text）。
export interface RateLimitResult {
  // 请求头 `X-Api-Token` 命中未过期会员记录时为 true；令牌过期/无效/缺失均为 false（按游客处理）
  isMember: boolean;
  // 令牌状态：仅当携带了令牌但校验未通过时非 null（expired=已过期，invalid=不存在/无效）
  tokenStatus: 'expired' | 'invalid' | null;
}

interface GroupConfig {
  guestBinding: keyof RateLimitEnv;
  memberBinding: keyof RateLimitEnv;
  guestLimit: number;
  memberLimit: number;
}

const GROUPS: Record<RateGroup, GroupConfig> = {
  query: { guestBinding: 'RL_GUEST_QUERY', memberBinding: 'RL_MEMBER_QUERY', guestLimit: 5, memberLimit: 100 },
  download: { guestBinding: 'RL_GUEST_DOWNLOAD', memberBinding: 'RL_MEMBER_DOWNLOAD', guestLimit: 1, memberLimit: 60 },
};

/**
 * 分级限流：会员（携带有效 `X-Api-Token`）享更高频率，游客按 IP 限制。
 *
 * - 会员判定：请求头 `X-Api-Token` 命中 KV 中未过期的会员记录
 * - 每个接口按 (身份, 路由) 独立计数（key 带上路由路径）
 * - 超限抛出 429（附 `Retry-After`）；绑定不存在时（本地 `nuxt dev`）跳过限流，不阻断开发
 *
 * @remarks 应在接口处理逻辑（proxy/fetch/cheerio）之前调用，使被限流的请求提前返回、不消耗 CPU。
 * @returns 身份判定结果（是否会员 / 令牌状态），供接口做会员专属能力控制；被限流时抛 429。
 */
export async function enforceRateLimit(event: H3Event, group: RateGroup): Promise<RateLimitResult> {
  // 会员/限速层未开启（默认，fork 私有部署）→ 完全不限速，也不区分会员/游客
  if (!useRuntimeConfig(event).public.membership.enabled) {
    return { isMember: false, tokenStatus: null };
  }

  const env = (event.context as { cloudflare?: { env?: RateLimitEnv } }).cloudflare?.env;

  const token = getRequestHeader(event, 'X-Api-Token') || '';

  // 校验令牌：有效 → 会员额度；过期 / 无效 → 降级为游客额度（不阻断），
  // 但通过响应头 X-Api-Token-Status 告知令牌状态（过期请续费），不静默当普通游客。
  let isMember = false;
  let tokenStatus: 'expired' | 'invalid' | null = null;
  if (token) {
    const lookup = await lookupMember(token);
    if (lookup.status === 'valid') {
      isMember = true;
    } else {
      tokenStatus = lookup.status === 'expired' ? 'expired' : 'invalid';
      setResponseHeader(event, 'X-Api-Token-Status', tokenStatus);
    }
  }

  const cfg = GROUPS[group];
  const limiter = isMember ? env?.[cfg.memberBinding] : env?.[cfg.guestBinding];

  // 每个接口独立计数：key 带上路由路径
  const route = (event.path || '').split('?')[0];
  const key = isMember ? `m:${token}:${route}` : `ip:${getClientIp(event)}:${route}`;

  // 无绑定（本地开发）→ 跳过限流，但仍返回已判定的身份
  if (!limiter) {
    return { isMember, tokenStatus };
  }

  const { success } = await limiter.limit({ key });
  if (!success) {
    setResponseHeader(event, 'Retry-After', 60);
    const limit = isMember ? cfg.memberLimit : cfg.guestLimit;
    let statusMessage: string;
    if (isMember) {
      statusMessage = `请求过于频繁：会员限 ${limit} 次/分钟，请稍后再试`;
    } else if (tokenStatus === 'expired') {
      statusMessage = `会员令牌已过期，已按游客限流（${limit} 次/分钟），续费后恢复会员额度`;
    } else if (tokenStatus === 'invalid') {
      statusMessage = `会员令牌无效，已按游客限流（${limit} 次/分钟）`;
    } else {
      statusMessage = `请求过于频繁：游客限 ${limit} 次/分钟，开通会员可提升限额`;
    }
    throw createError({ statusCode: 429, statusMessage });
  }

  return { isMember, tokenStatus };
}
