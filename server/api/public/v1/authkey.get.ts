import { getMpCookie } from '~/server/kv/cookie';
import { getAuthKeyFromRequest } from '~/server/utils/proxy-request';

// 会话有效期：4天（毫秒）
const SESSION_TTL_MS = 60 * 60 * 24 * 4 * 1000;

export default defineEventHandler(async event => {
  const authKey = getAuthKeyFromRequest(event);

  // 这里进行服务器验证，确定请求中的 auth-key 是否还有效
  const cookie = await getMpCookie(authKey);

  if (authKey && cookie) {
    // 计算过期时间
    const expiresAt = cookie.createdAt
      ? new Date(cookie.createdAt + SESSION_TTL_MS).toISOString()
      : null;

    // 计算剩余时间（小时）
    const remainingHours = cookie.createdAt
      ? Math.max(0, Math.round((cookie.createdAt + SESSION_TTL_MS - Date.now()) / 1000 / 60 / 60))
      : null;

    return {
      code: 0,
      data: authKey,
      expiresAt: expiresAt,
      remainingHours: remainingHours,
    };
  } else {
    return {
      code: -1,
      msg: 'AuthKey not found',
    };
  }
});
