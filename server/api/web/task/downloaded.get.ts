import * as fs from 'fs';
import * as path from 'path';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const nickname = query.nickname as string;
  if (!nickname) {
    return { error: '参数缺失' };
  }

  const downloadedPath = path.join('/workspace', '.meta', nickname, 'downloaded.json');
  if (!fs.existsSync(downloadedPath)) {
    return [];
  }

  try {
    const content = fs.readFileSync(downloadedPath, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return [];
  }
});
