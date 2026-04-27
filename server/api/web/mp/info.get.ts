/**
 * 获取登录用户信息接口
 *
 * 备注：
 * 这个接口用于后端登录成功之后调用，非客户端直接调用
 */

import { getTokenFromEvent } from '~/server/services/api/auth-session';
import { fetchMpHomeInfo } from '~/server/services/api/mp-service';

export default defineEventHandler(async event => {
  const token = await getTokenFromEvent(event);
  if (!token) {
    return { nick_name: '', head_img: '', error: '未登录或登录已过期，请重新扫码登录' };
  }

  return fetchMpHomeInfo(event, token);
});
