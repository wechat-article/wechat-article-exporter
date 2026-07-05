import { parseCgiDataNew } from '#shared/utils/html';
import { renderHTMLFromCgiDataNew } from '#shared/utils/renderer';
import { read, samples, write } from './common';

function normalizeOutPath(input: string): string {
  const segments = input.split('/');
  segments[segments.length - 1] = 'output/normalize-cgi-data-' + segments[segments.length - 1];
  return segments.join('/');
}

async function run() {
  for (const group of samples.filter(group => group.hasContent)) {
    if (group.name !== '普通图文') continue;

    console.group(group.name);
    for (const samplePath of group.samples) {
      try {
        const html = read(samplePath);
        const cgiData = await parseCgiDataNew(html);
        if (!cgiData) {
          console.warn('提取 window.cgiDataNew 对象失败:', samplePath);
          continue;
        }
        console.log('item_show_type:', cgiData.item_show_type);
        // Node.js 环境无 IndexedDB，跳过 comments 渲染
        const normalizeHTML = await renderHTMLFromCgiDataNew(cgiData, false);
        write(normalizeOutPath(samplePath), normalizeHTML);
      } catch (e) {
        console.error('处理失败:', samplePath, e);
      }
    }
    console.groupEnd();
    console.log();
    break;
  }
}

run();
