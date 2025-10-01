/**
 * 切换公众号
 */

import { getAuthKey, proxyMpRequest } from '~/server/utils/proxy-request';
import { cookieStore } from '~/server/utils/CookieStore';
import dayjs from 'dayjs';

interface SwitchAccountQuery {
  username: string;
  token: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<SwitchAccountQuery>(event);

  const params = {
    action: 'switch',
  };
  const payload = {
    fingerprint: 'd468716e2b2e683b61ad4fd9b3b5d91d',
    username: query.username,
    token: query.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  };

  const response = await proxyMpRequest({
    event: event,
    method: 'POST',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/switchacct',
    query: params,
    body: payload,
    action: 'switch_account',
  });

  const resp = await response.json();
  if (resp && resp.base_resp && resp.base_resp.ret === 201501) {
    // 未授权使用切换账号能力，请退出后重新扫码登录
    return {
      base_resp: {
        ret: 201501,
        err_msg: '未授权使用切换账号能力，请退出后重新扫码登录',
      },
    };
  } else if (!resp || !resp.base_resp || resp.base_resp.ret !== 0) {
    return (
      resp || {
        base_resp: {
          ret: -1,
          err_msg: '服务异常，请稍后再试',
        },
      }
    );
  }

  // 重定向到 /
  const redirectResp: Response = await proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/',
    redirect: 'manual',
  });
  const redirect_url = redirectResp.headers.get('Location');
  if (redirectResp.status !== 302 || !redirect_url) {
    return {
      base_resp: {
        ret: -2,
        err_msg: '服务异常，请稍后再试',
      },
    };
  }

  // 后续流程与登录一致
  const authKey = getAuthKey(event);
  const token = new URL(`http://localhost${redirect_url}`).searchParams.get('token');
  const { nick_name, head_img } = await $fetch(`/api/web/mp/info?token=${token}`, {
    headers: {
      Cookie: `auth-key=${authKey}`,
    },
  });
  if (!nick_name || !token) {
    return {
      base_resp: {
        ret: -3,
        err_msg: '获取公众号昵称失败，请稍后重试',
      },
    };
  }

  // 为了与对外接口统一，需要将 token 与 authKey 关联
  cookieStore.bindToken(authKey, token);

  const body = JSON.stringify({
    base_resp: {
      ret: 0,
      err_msg: 'ok',
    },
    data: {
      nickname: nick_name,
      avatar: head_img,
      token: token,
      expires: dayjs().add(3, 'days').toString(),
    },
  });
  const headers = new Headers(response.headers);
  headers.set('Content-Length', new TextEncoder().encode(body).length.toString());
  return new Response(body, { headers: headers });
});
