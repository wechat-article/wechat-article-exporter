/**
 * 调试钉钉机器人发送消息
 */

import { getDingTalkSignature } from '~/server/utils/ding-talk';

interface Body {
  webhookUrl: string;
  secret: string;
  payload: Record<string, any>;
}

export default defineEventHandler(async event => {
  const { webhookUrl, secret, payload } = await readBody<Body>(event);

  let url = webhookUrl;
  // 计算签名
  if (secret) {
    const timestamp = Date.now().toString();
    const sign = getDingTalkSignature(timestamp, secret);
    url += `&timestamp=${timestamp}&sign=${sign}`;
  }

  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  }).then(resp => resp.json());
});
