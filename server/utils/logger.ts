import path from 'node:path';
import fs from 'node:fs';
import { root } from '~/server/config';

const logFilePath = path.resolve(root, '.data/request.log');

// 写入日志文件
function logToFile(prefix: string, message: string) {
  // 确保日志目录存在
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const timestamp = new Date().toISOString();
  const logEntry = `[${prefix} ${timestamp}]\n${message}\n\n\n`;
  fs.appendFileSync(logFilePath, logEntry, 'utf8');
}

// 记录 HTTP 请求报文
export async function logRequest(requestId: string, request: Request) {
  // 读取请求体
  let requestBody = '<nil>';
  if (request.body) {
    requestBody = await request.text();
  }

  const requestLog = `Request-ID: ${requestId}
${request.method} ${request.url} HTTP/1.1
Host: ${new URL(request.url).host}
${[...request.headers.entries()].map(([key, value]) => `${key}: ${value}`).join('\n')}

${requestBody}`;
  logToFile('请求', requestLog);
}

// 记录 HTTP 响应报文
export async function logResponse(requestId: string, response: Response) {
  let responseBody = '';
  if (response.headers.get('Content-Type') === 'application/json') {
    responseBody = JSON.stringify(await response.json(), null, 2);
  } else {
    responseBody = await response.text();
  }
  // 日志里面只需要记录一部分即可，因为主要目的是查看整个通信过程
  responseBody = responseBody.length > 200 ? responseBody.slice(0, 200) + '...' : responseBody;

  const responseLog = `Request-ID: ${requestId}
HTTP/1.1 ${response.status} ${response.statusText}
${Array.from(response.headers.entries())
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
${responseBody ? `\n${responseBody}` : '\n<nil>'}`;
  logToFile('响应', responseLog);
}
