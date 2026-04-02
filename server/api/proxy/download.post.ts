/**
 * 服务端代理中转端点
 * 浏览器 → Nitro 服务器 → 外部代理 → 微信
 *
 * 解决部署到服务器后，浏览器直接请求代理时遇到的 CORS / 网络不可达等问题
 */

export default defineEventHandler(async event => {
  const body = await readBody(event);
  const { proxyUrl, url, headers, authorization } = body as {
    proxyUrl: string;
    url: string;
    headers: Record<string, string>;
    authorization: string;
  };

  if (!proxyUrl || !url) {
    throw createError({ statusCode: 400, statusMessage: '缺少 proxyUrl 或 url 参数' });
  }

  // 构造与客户端相同的代理请求 URL
  const targetUrl = `${proxyUrl}?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(JSON.stringify(headers || {}))}&authorization=${authorization || ''}`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch(targetUrl, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createError({ statusCode: response.status, statusMessage: `代理请求失败: ${response.statusText}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';

    // 以 Buffer 形式返回，保留原始内容
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    setResponseHeader(event, 'Content-Type', contentType);
    setResponseHeader(event, 'Content-Length', buffer.length);

    return buffer;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw createError({ statusCode: 504, statusMessage: '代理请求超时' });
    }
    // 如果已经是 H3Error 直接抛出
    if (error.statusCode) {
      throw error;
    }
    throw createError({ statusCode: 502, statusMessage: `代理请求异常: ${error.message}` });
  } finally {
    clearTimeout(timeoutId);
  }
});
