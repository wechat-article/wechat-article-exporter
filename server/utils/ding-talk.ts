import crypto from 'node:crypto';

/**
 * 计算钉钉机器人签名
 * @param {string} timestamp - 当前时间戳（毫秒）
 * @param {string} secret - 密钥
 * @returns {string} - 签名字符串
 */
export function getDingTalkSignature(timestamp: string, secret: string): string {
  // 1. 将时间戳和密钥拼接成签名字符串
  const signString = timestamp + '\n' + secret;

  // 2. 使用 HmacSHA256 算法计算签名
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(signString);
  const signature = hmac.digest('base64');

  // 3. 对签名进行 URL 编码（UTF-8）
  const encodedSignature = encodeURIComponent(signature);

  return encodedSignature;
}
