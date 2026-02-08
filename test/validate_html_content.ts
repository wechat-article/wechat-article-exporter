import { validateHTMLContent } from '#shared/utils/html';
import { read, samples } from './common';

function run() {
  for (const group of samples) {
    console.group(group.name);
    for (const samplePath of group.samples) {
      const html = read(samplePath);
      const result = validateHTMLContent(html);
      console.log(result);
    }
    console.groupEnd();
    console.log();
  }
}

run();
