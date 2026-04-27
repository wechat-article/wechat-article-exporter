import * as cheerio from 'cheerio';
import { H3Event } from 'h3';

import { USER_AGENT } from '../../../config';
import { getSessionByAuthKey, getTokenFromEvent } from './auth-session';
import { buildAppMsgPublishParams, buildSearchBizParams, filterSearchBizResponseByNickname } from './mp-core';
import { proxyMpRequest } from './mp-gateway';

interface SearchBizInput {
  begin?: number;
  keyword: string;
  size?: number;
  token: string;
}

interface AppMsgPublishInput {
  begin?: number;
  fakeid: string;
  keyword?: string;
  size?: number;
  token: string;
}

interface SearchAccountByUrlInput {
  authErrorMessage: string;
  searchErrorMessage: string;
  url: string;
}

interface AuthorInfoInput {
  fakeid: string;
}

interface ProfileExtGetMsgInput {
  begin?: number;
  id: string;
  key: string;
  pass_ticket: string;
  size?: number;
  uin: string;
}

interface AppMsgAlbumInput {
  album_id: string;
  begin_itemidx?: string;
  begin_msgid?: string;
  count?: number;
  fakeid: string;
  is_reverse?: string;
}

interface CommentInput {
  __biz: string;
  comment_id: string;
  key: string;
  pass_ticket: string;
  uin: string;
}

const ALLOWED_HOSTS = new Set(['mp.weixin.qq.com', 'weixin.qq.com']);

function isAllowedUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') {
      return false;
    }

    return ALLOWED_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

export async function fetchSearchBizResponse(event: H3Event, input: SearchBizInput) {
  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/searchbiz',
    query: buildSearchBizParams(input),
    parseJson: true,
  });
}

export async function fetchAppMsgPublishResponse(event: H3Event, input: AppMsgPublishInput) {
  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/appmsgpublish',
    query: buildAppMsgPublishParams(input),
    parseJson: true,
  });
}

export async function fetchAuthorInfoResponse(event: H3Event, input: AuthorInfoInput) {
  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/mp/authorinfo',
    query: {
      wxtoken: '777',
      biz: input.fakeid,
      __biz: input.fakeid,
      x5: 0,
      f: 'json',
    },
    parseJson: true,
  });
}

export async function fetchProfileExtGetMsgResponse(event: H3Event, input: ProfileExtGetMsgInput) {
  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/mp/profile_ext',
    query: {
      action: 'getmsg',
      __biz: input.id,
      offset: input.begin || 0,
      count: input.size || 10,
      uin: input.uin,
      key: input.key,
      pass_ticket: input.pass_ticket,
      f: 'json',
      is_ok: '1',
      scene: '124',
    },
    parseJson: true,
  });
}

export async function fetchAppMsgAlbumResponse(event: H3Event, input: AppMsgAlbumInput) {
  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/mp/appmsgalbum',
    query: {
      action: 'getalbum',
      __biz: input.fakeid,
      album_id: input.album_id,
      begin_msgid: input.begin_msgid,
      begin_itemidx: input.begin_itemidx,
      count: input.count || 20,
      is_reverse: input.is_reverse || '0',
      f: 'json',
    },
    parseJson: true,
  });
}

export async function fetchCommentResponse(event: H3Event, input: CommentInput) {
  return proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/mp/appmsg_comment',
    query: {
      action: 'getcomment',
      __biz: input.__biz,
      comment_id: input.comment_id,
      uin: input.uin,
      key: input.key,
      pass_ticket: input.pass_ticket,
      limit: 1000,
      f: 'json',
    },
    parseJson: false,
  });
}

export function extractMpHomeInfo(rawHtml: string) {
  let nick_name = '';
  const nicknameMatchResult = rawHtml.match(/wx\.cgiData\.nick_name\s*?=\s*?"(?<nick_name>[^"]+)"/);
  if (nicknameMatchResult?.groups?.nick_name) {
    nick_name = nicknameMatchResult.groups.nick_name;
  }

  let head_img = '';
  const headImgMatchResult = rawHtml.match(/wx\.cgiData\.head_img\s*?=\s*?"(?<head_img>[^"]+)"/);
  if (headImgMatchResult?.groups?.head_img) {
    head_img = headImgMatchResult.groups.head_img;
  }

  return {
    nick_name,
    head_img,
  };
}

export async function fetchMpHomeInfo(event: H3Event, token: string, cookie?: string) {
  const html: string = await proxyMpRequest({
    event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/home',
    query: {
      t: 'home/index',
      token,
      lang: 'zh_CN',
    },
    cookie,
  }).then(resp => resp.text());

  return extractMpHomeInfo(html);
}

export async function fetchMpHomeInfoByAuthKey(event: H3Event, authKey: string) {
  const session = await getSessionByAuthKey(authKey);
  if (!session) {
    return null;
  }

  return fetchMpHomeInfo(event, session.token, session.toCookieHeader());
}

export async function searchAccountByArticleUrl(event: H3Event, input: SearchAccountByUrlInput) {
  const name = await resolveAccountNameFromArticleUrl(input.url);
  if (!name) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url解析公众号名称失败',
      },
    };
  }

  const token = await getTokenFromEvent(event);
  if (!token) {
    return {
      base_resp: {
        ret: -1,
        err_msg: input.authErrorMessage,
      },
    };
  }

  const originalResp = await fetchSearchBizResponse(event, {
    token,
    keyword: name,
    size: 20,
  }).catch(() => {
    return {
      base_resp: {
        ret: -1,
        err_msg: input.searchErrorMessage,
      },
    };
  });

  if (originalResp.base_resp.ret !== 0) {
    return originalResp;
  }

  return filterSearchBizResponseByNickname(originalResp, name);
}

export async function resolveAccountNameFromArticleUrl(rawUrl: string): Promise<string> {
  const url = decodeURIComponent(rawUrl);
  if (!isAllowedUrl(url)) {
    throw createError({
      statusCode: 400,
      statusMessage: '不允许的 URL：仅支持微信公众平台域名',
    });
  }

  const rawHtml = await fetch(url, {
    headers: {
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      'User-Agent': USER_AGENT,
    },
    redirect: 'error',
  }).then(resp => resp.text());

  const $ = cheerio.load(rawHtml);
  return $('.wx_follow_nickname:first').text().trim();
}
