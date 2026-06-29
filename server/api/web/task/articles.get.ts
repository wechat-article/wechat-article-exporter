import * as fs from 'fs';
import * as path from 'path';

export default defineEventHandler(async event => {
  const query = getQuery(event);
  const nickname = query.nickname as string;
  if (!nickname) {
    return { error: '参数缺失' };
  }

  const articlesPath = path.join('/workspace', '.meta', nickname, 'articles.json');
  if (!fs.existsSync(articlesPath)) {
    return { error: '同步元数据文件不存在' };
  }

  const content = fs.readFileSync(articlesPath, 'utf8');
  return JSON.parse(content);
});
