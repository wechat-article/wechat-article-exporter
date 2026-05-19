// 本地代理服务：替代公共 Cloudflare Worker 代理
// 用法：node local-proxy.mjs
// 然后在设置页面的"代理节点"填入 http://localhost:3001

import http from 'node:http';
import https from 'node:https';

const PORT = 3001;

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url, `http://localhost:${PORT}`);

  if (reqUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  const targetUrl = reqUrl.searchParams.get('url');
  if (!targetUrl) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'missing url parameter' }));
    return;
  }

  // 解析自定义 headers
  let customHeaders = {};
  const headersParam = reqUrl.searchParams.get('headers');
  if (headersParam) {
    try {
      customHeaders = JSON.parse(decodeURIComponent(headersParam));
    } catch {}
  }

  console.log(`[proxy] ${targetUrl}`);

  try {
    const parsedTarget = new URL(targetUrl);

    const proxyHeaders = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
      Referer: 'https://mp.weixin.qq.com/',
      Origin: 'https://mp.weixin.qq.com',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      ...customHeaders,
    };

    const proxyReq = https.get(targetUrl, { headers: proxyHeaders }, (proxyRes) => {
      // 处理重定向
      if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
        const redirectUrl = new URL(proxyRes.headers.location, targetUrl).toString();
        console.log(`[proxy] redirect -> ${redirectUrl}`);
        https.get(redirectUrl, { headers: proxyHeaders }, (redirectRes) => {
          res.writeHead(redirectRes.statusCode, {
            'Content-Type': redirectRes.headers['content-type'] || 'text/html',
            'Access-Control-Allow-Origin': '*',
          });
          redirectRes.pipe(res);
        }).on('error', (e) => {
          console.error('[proxy] redirect error:', e.message);
          res.writeHead(502);
          res.end(JSON.stringify({ error: e.message }));
        });
        return;
      }

      res.writeHead(proxyRes.statusCode, {
        'Content-Type': proxyRes.headers['content-type'] || 'text/html',
        'Access-Control-Allow-Origin': '*',
      });
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (e) => {
      console.error('[proxy] error:', e.message);
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    });
  } catch (e) {
    console.error('[proxy] invalid url:', e.message);
    res.writeHead(400);
    res.end(JSON.stringify({ error: 'invalid url' }));
  }
});

server.listen(PORT, () => {
  console.log(`[local-proxy] running at http://localhost:${PORT}`);
  console.log(`[local-proxy] 在设置页面的"代理节点"填入: http://localhost:${PORT}`);
});
