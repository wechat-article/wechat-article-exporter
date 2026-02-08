import { normalizeHtml } from '#shared/utils/html';
import { read, samples, write } from './common';

function normalizeOutPath(input: string): string {
  const segments = input.split('/');
  segments[segments.length - 1] = 'output/normalize-' + segments[segments.length - 1];
  return segments.join('/');
}

function run() {
  for (const group of samples.filter(group => group.hasContent)) {
    console.group(group.name);
    for (const samplePath of group.samples) {
      const html = read(samplePath);
      const result = normalizeHtml(html);
      write(normalizeOutPath(samplePath), result);
      console.log(samplePath, '已处理');
    }
    console.groupEnd();
    console.log();
  }
}

run();
