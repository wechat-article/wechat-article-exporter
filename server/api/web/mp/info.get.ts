/**
 * 获取登录用户信息接口
 *
 * 备注：
 * 这个接口用于后端登录成功之后调用，非客户端直接调用
 */

import { proxyMpRequest } from '~/server/utils/proxy-request';

interface GetInfoQuery {
  token: string;
}

export default defineEventHandler(async event => {
  const query = getQuery<GetInfoQuery>(event);

  const html: string = await proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/home',
    query: {
      t: 'home/index',
      token: query.token,
      lang: 'zh_CN',
    },
  }).then(resp => resp.text());

  // 提取昵称
  let nick_name = '';
  const nicknameMatchResult = html.match(/wx\.cgiData\.nick_name\s*?=\s*?"(?<nick_name>[^"]+)"/);
  if (nicknameMatchResult && nicknameMatchResult.groups && nicknameMatchResult.groups.nick_name) {
    nick_name = nicknameMatchResult.groups.nick_name;
  }

  // 提取头像
  let head_img = '';
  const headImgMatchResult = html.match(/wx\.cgiData\.head_img\s*?=\s*?"(?<head_img>[^"]+)"/);
  if (headImgMatchResult && headImgMatchResult.groups && headImgMatchResult.groups.head_img) {
    head_img = headImgMatchResult.groups.head_img;
  }

  return {
    nick_name: nick_name,
    head_img: head_img,
  };
});
