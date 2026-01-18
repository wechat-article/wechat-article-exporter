import { parseCgiDataNew } from '#shared/utils/html';
import { samples, read, write } from './common';

function normalizeOutPath(input: string): string {
  const segments = input.split('/');
  segments[segments.length - 1] = 'parse-' + segments[segments.length - 1];
  return segments.join('/').replace(/\.html$/, '.json');
}

async function run() {
  for (const group of samples.filter(group => group.hasContent)) {
    console.group(group.name);
    for (const samplePath of group.samples) {
      const html = read(samplePath);
      const cgiData = await parseCgiDataNew(html);
      if (!cgiData) {
        console.warn('提取 window.cgiDataNew 对象失败');
        continue;
      }
      console.log(cgiData.item_show_type);
      write(normalizeOutPath(samplePath), JSON.stringify(cgiData, null, 2));
    }
    console.groupEnd();
    console.log();
  }
}

run();
