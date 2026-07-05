import fs from 'node:fs';
import path from 'node:path';
import { isDev } from '~/config';
import { extractAboutBizInfo } from '~/server/utils/aboutbiz-parser';
import {
  buildAllowedWechatDirectFetchUrl,
  createWechatDirectFetchRequestInit,
  toSafeWechatDebugFileSegment,
  WECHAT_ABOUT_BIZ_ENDPOINT,
} from '~/server/utils/wechat-direct-fetch';

interface AboutBizQuery {
  fakeid: string;
  key: string;
}

const USER_AGENT =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) MicroMessenger/8.0.64(0x18004034) Language/zh_CN';
const ABOUT_BIZ_SAMPLE_DIR = 'samples/aboutbiz';

export default defineEventHandler(async event => {
  const { fakeid, key } = getQuery<AboutBizQuery>(event);
  if (!fakeid) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'fakeid不能为空',
      },
    };
  }

  const query: Record<string, string> = {
    __biz: fakeid,
    wx_header: process.env.NUXT_WECHAT_ABOUT_BIZ_WX_HEADER || '',
  };
  const aboutBizUrl = buildAllowedWechatDirectFetchUrl(WECHAT_ABOUT_BIZ_ENDPOINT, { query });
  if (!aboutBizUrl.allowed) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'aboutbiz URL 构造被拒绝',
      },
    };
  }

  // const rawHtml = fs.readFileSync('samples/aboutbiz/biz-Mzg3OTYzMDkzMg==.html', 'utf8');
  const rawHtml = await fetch(aboutBizUrl.url, {
    method: 'GET',
    ...createWechatDirectFetchRequestInit({
      'User-Agent': USER_AGENT,
      'x-wechat-uin': process.env.NUXT_WECHAT_ABOUT_BIZ_UIN || '',
      'x-wechat-key': key || process.env.NUXT_WECHAT_ABOUT_BIZ_KEY || '',
    }),
  }).then(resp => resp.text());

  // 写入文件方便调试
  if (isDev) {
    fs.mkdirSync(ABOUT_BIZ_SAMPLE_DIR, { recursive: true });
    fs.writeFileSync(path.join(ABOUT_BIZ_SAMPLE_DIR, `biz-${toSafeWechatDebugFileSegment(fakeid)}.html`), rawHtml);
  }

  const result = extractAboutBizInfo(rawHtml);
  if (Object.keys(result).length > 0) {
    return {
      base_resp: {
        ret: 0,
      },
      data: result,
    };
  } else {
    return {
      base_resp: {
        ret: -1,
        err_msg: '密钥已过期',
      },
    };
  }
});
