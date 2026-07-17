export type MemberToken = string;

export interface MemberValue {
  // 到期时间（毫秒时间戳）。超过即视为已过期。
  expiresAt: number;
  // 备注（如微信号 / 昵称 / 订单号），便于管理
  note?: string;
  // 创建时间（毫秒时间戳）
  createdAt?: number;
}

// 令牌查询结果：区分有效 / 已过期 / 不存在（含被清理或从未存在）。
// 调用方据此在过期/无效时降级为游客额度，并通过响应头 X-Api-Token-Status 告知用户令牌状态。
export type MemberLookup =
  | { status: 'valid'; member: MemberValue }
  | { status: 'expired'; member: MemberValue }
  | { status: 'notfound' };

/**
 * 查询令牌的会员状态
 *
 * @description KV 键为 `member:<token>`（与 `cookie:*` 同约定）。会员由线下收款后手动发放
 * （见 scripts/issue-member.sh），发放时 KV 过期时间比 expiresAt 多留一段宽限期，
 * 使刚过期的令牌仍能命中并返回 'expired'（而非被清理后的 'notfound'）。
 * @param token 会员令牌（来自请求头 X-Api-Token）
 */
export async function lookupMember(token: MemberToken): Promise<MemberLookup> {
  if (!token) {
    return { status: 'notfound' };
  }

  const kv = useStorage('kv');
  const member = await kv.get<MemberValue>(`member:${token}`);
  if (!member) {
    return { status: 'notfound' };
  }

  if (typeof member.expiresAt === 'number' && Date.now() > member.expiresAt) {
    return { status: 'expired', member };
  }

  return { status: 'valid', member };
}
