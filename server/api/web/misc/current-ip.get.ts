/**
 * 查询当前ip
 */
import { getClientIp } from '~/server/utils/client-ip';

export default defineEventHandler(async event => {
  // 查询用户的当前ip并返回
  return {
    ip: getClientIp(event),
  };
});
