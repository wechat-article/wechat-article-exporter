import fs from 'node:fs';
import path from 'node:path';

// ==================== 配置 ====================
const LOG_DIR = path.resolve(process.cwd(), process.env.LOG_DIR || 'log');
const retentionDays = parseInt(process.env.LOG_RETENTION_DAYS ?? '7', 10);
const MAX_RETENTION_DAYS = Number.isSafeInteger(retentionDays) && retentionDays >= 0 ? retentionDays : 14;
const FLUSH_INTERVAL_MS = 500;

export function getAsyncLogDir(): string {
  return LOG_DIR;
}

// ==================== 工具函数（导出给 logger.ts 等模块使用） ====================

/** 格式化时间戳: 2026-04-10 17:22:05 */
export function formatLogTimestamp(date?: Date): string {
  const d = date || new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const UNICODE_ESCAPE_RE = /[\u007f-\uffff]/g;

function escapeUnicode(text: string): string {
  return text.replace(UNICODE_ESCAPE_RE, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`;
  });
}

/** 将对象转为压缩的 JSON 字符串（不转义 Unicode） */
export function compactJson(obj: any): string {
  try {
    return JSON.stringify(obj);
  } catch {
    return String(obj);
  }
}

/** 将对象转为压缩的 JSON 字符串（转义 Unicode） */
export function compactEscapedJson(obj: any): string {
  try {
    return escapeUnicode(compactJson(obj));
  } catch {
    return escapeUnicode(String(obj));
  }
}

/** 获取当日日志文件名: 2026-04-10.log */
function getDailyLogFileName(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.log`;
}

// ==================== 异步文件日志系统 ====================

let buffer: string[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let initialized = false;

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

/** 将缓冲区内容写入磁盘 */
function flushBuffer() {
  if (buffer.length === 0) return;
  const lines = buffer.splice(0, buffer.length);
  const content = lines.join('');
  const filePath = path.join(LOG_DIR, getDailyLogFileName());
  try {
    ensureLogDir();
    fs.appendFileSync(filePath, content, 'utf8');
  } catch (e) {
    // 写入失败时输出到 stderr，避免递归
    process.stderr.write(`[async-log] 写入日志文件失败: ${e}\n`);
  }
}

/** 清理过期日志（保留最近 MAX_RETENTION_DAYS 天） */
function cleanOldLogs() {
  try {
    if (!fs.existsSync(LOG_DIR)) return;
    const files = fs.readdirSync(LOG_DIR).filter(f => /^\d{4}-\d{2}-\d{2}\.log$/.test(f));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - MAX_RETENTION_DAYS);
    cutoff.setHours(0, 0, 0, 0);

    for (const file of files) {
      const dateStr = file.replace('.log', '');
      const fileDate = new Date(dateStr + 'T00:00:00');
      if (fileDate < cutoff) {
        fs.unlinkSync(path.join(LOG_DIR, file));
      }
    }
  } catch (e) {
    process.stderr.write(`[async-log] 清理旧日志失败: ${e}\n`);
  }
}

/** 向缓冲区追加一行日志 */
function appendToBuffer(line: string) {
  buffer.push(line + '\n');
}

/** 格式化日志级别标签 */
function levelTag(level: string): string {
  return level.toUpperCase();
}

/** 将参数序列化为字符串（类似 console.log 行为） */
function formatArgs(args: any[]): string {
  return args.map(a => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return `${a.message}\n${a.stack || ''}`;
    try {
      return compactEscapedJson(a);
    } catch {
      return String(a);
    }
  }).join(' ');
}

// ==================== 拦截 console 输出 ====================

const _origLog = console.log;
const _origWarn = console.warn;
const _origError = console.error;
const _origDebug = console.debug;

function interceptedLog(level: string, origFn: (...args: any[]) => void, ...args: any[]) {
  const ts = formatLogTimestamp();
  const tag = levelTag(level);
  const msg = formatArgs(args);
  const line = `[${ts}] [${tag}] ${msg}`;
  // 同时输出到原始控制台（保留开发便利性）
  origFn.call(console, line);
  // 追加到异步缓冲区
  appendToBuffer(line);
}

/** 初始化异步日志系统：拦截 console，启动定时刷盘，清理过期日志 */
export function initAsyncFileLog() {
  if (initialized) return;
  initialized = true;

  ensureLogDir();

  // 拦截 console 方法
  console.log = (...args: any[]) => interceptedLog('LOG', _origLog, ...args);
  console.warn = (...args: any[]) => interceptedLog('WARN', _origWarn, ...args);
  console.error = (...args: any[]) => interceptedLog('ERROR', _origError, ...args);
  console.debug = (...args: any[]) => interceptedLog('DEBUG', _origDebug, ...args);

  // 定时刷盘
  flushTimer = setInterval(flushBuffer, FLUSH_INTERVAL_MS);

  // 进程退出前刷盘
  process.on('beforeExit', flushBuffer);
  process.on('exit', flushBuffer);
  process.on('SIGINT', () => { flushBuffer(); process.exit(0); });
  process.on('SIGTERM', () => { flushBuffer(); process.exit(0); });

  // 捕获未处理异常，写入日志
  process.on('uncaughtException', (err) => {
    const ts = formatLogTimestamp();
    const line = `[${ts}] [ERROR] [uncaughtException] ${err.stack || err.message}`;
    _origError.call(console, line);
    appendToBuffer(line);
    flushBuffer();
  });

  // 清理过期日志
  cleanOldLogs();

  console.log(`[file-log] 异步文件日志已启用，目录: ${LOG_DIR}，保留天数: ${MAX_RETENTION_DAYS}，刷盘间隔: ${FLUSH_INTERVAL_MS}ms`);
  flushBuffer();
}

// 自动初始化
initAsyncFileLog();
