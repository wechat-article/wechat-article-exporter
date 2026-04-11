import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compactEscapedJson } from '~/server/utils/async-log';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logFilePath = path.resolve(__dirname, '.data/request.log');

function isJsonContentType(contentType: string | null): boolean {
  return contentType?.toLowerCase().includes('application/json') ?? false;
}

function compactJsonText(body: string): string {
  try {
    return compactEscapedJson(JSON.parse(body));
  } catch {
    return body;
  }
}

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
    if (isJsonContentType(request.headers.get('Content-Type'))) {
      requestBody = compactJsonText(requestBody);
    }
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
  if (isJsonContentType(response.headers.get('Content-Type'))) {
    responseBody = compactJsonText(await response.text());
  } else {
    responseBody = await response.text();
  }
  // 完整记录响应体，不截断
  const responseLog = `Request-ID: ${requestId}
HTTP/1.1 ${response.status} ${response.statusText}
${Array.from(response.headers.entries())
  .map(([key, value]) => `${key}: ${value}`)
  .join('\n')}
${responseBody ? `\n${responseBody}` : '\n<nil>'}`;
  logToFile('响应', responseLog);
}
