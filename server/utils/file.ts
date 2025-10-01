import path from 'node:path';
import { root } from '~/server/config';
import fs from 'node:fs';

const dataFilePath = path.resolve(root, '.data/data.json');

// 写入日志文件
export function writeToFile(data: any) {
  // 确保日志目录存在
  const logDir = path.dirname(dataFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  fs.writeFileSync(dataFilePath, JSON.stringify(data), 'utf8');
}
