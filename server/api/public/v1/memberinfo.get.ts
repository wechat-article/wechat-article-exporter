/**
 * 查询会员令牌详情（自助）
 * @description 凭请求头 X-Api-Token 返回该令牌的状态与到期信息，供用户在页面自查。
 */
import { lookupMember } from '~/server/kv/member';
import { enforceRateLimit } from '~/server/utils/rate-limit';

export default defineEventHandler(async event => {
  // 轻量限流（查询类档位，按路由独立计数），防止刷接口
  await enforceRateLimit(event, 'query');

  const token = getRequestHeader(event, 'X-Api-Token') || '';
  const lookup = token ? await lookupMember(token) : ({ status: 'notfound' } as const);

  if (lookup.status === 'notfound') {
    return { status: 'notfound' as const };
  }

  const { expiresAt, createdAt } = lookup.member;
  const remainingMs = expiresAt - Date.now();

  return {
    status: lookup.status, // 'valid' | 'expired'
    expiresAt,
    createdAt: createdAt ?? null,
    remainingDays: Math.max(0, Math.ceil(remainingMs / 86400000)),
    remainingMs: Math.max(0, remainingMs),
  };
});
