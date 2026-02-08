import path from 'node:path';
import fs from 'node:fs';

const samplesDirectory = path.join(__dirname, '../samples');

interface HtmlSampleGroup {
  name: string;
  samples: string[];
  hasContent: boolean;
}

export const samples: HtmlSampleGroup[] = [
  {
    name: '作者已删除',
    hasContent: false,
    samples: [
      path.join(samplesDirectory, '作者已删除/01.html'),
      path.join(samplesDirectory, '作者已删除/02.html'),
      path.join(samplesDirectory, '作者已删除/03.html'),
      path.join(samplesDirectory, '作者已删除/04.html'),
      path.join(samplesDirectory, '作者已删除/05.html'),
      path.join(samplesDirectory, '作者已删除/06.html'),
    ],
  },
  {
    name: '内容违规',
    hasContent: false,
    samples: [path.join(samplesDirectory, '内容违规/01.html'), path.join(samplesDirectory, '内容违规/02.html')],
  },
  {
    name: '图片分享',
    hasContent: true,
    samples: [
      path.join(samplesDirectory, '图片分享/01.html'),
      path.join(samplesDirectory, '图片分享/02.html'),
      path.join(samplesDirectory, '图片分享/03.html'),
      path.join(samplesDirectory, '图片分享/04.html'),
      path.join(samplesDirectory, '图片分享/05.html'),
    ],
  },
  {
    name: '文本分享',
    hasContent: true,
    samples: [
      path.join(samplesDirectory, '文本分享/01.html'),
      path.join(samplesDirectory, '文本分享/02.html'),
      path.join(samplesDirectory, '文本分享/03.html'),
      path.join(samplesDirectory, '文本分享/04.html'),
      path.join(samplesDirectory, '文本分享/c01.html'),
      path.join(samplesDirectory, '文本分享/c02.html'),
      path.join(samplesDirectory, '文本分享/c03.html'),
      path.join(samplesDirectory, '文本分享/c04.html'),
      path.join(samplesDirectory, '文本分享/c05.html'),
    ],
  },
  {
    name: '文章分享',
    hasContent: true,
    samples: [
      path.join(samplesDirectory, '文章分享/01.html'),
      path.join(samplesDirectory, '文章分享/02.html'),
      path.join(samplesDirectory, '文章分享/03.html'),
      path.join(samplesDirectory, '文章分享/04.html'),
    ],
  },
  {
    name: '普通图文',
    hasContent: true,
    samples: [
      path.join(samplesDirectory, '普通图文/01.html'),
      path.join(samplesDirectory, '普通图文/02.html'),
      path.join(samplesDirectory, '普通图文/03.html'),
      path.join(samplesDirectory, '普通图文/04.html'),
      path.join(samplesDirectory, '普通图文/c01.html'),
    ],
  },
  {
    name: '该内容暂时无法查看',
    hasContent: false,
    samples: [path.join(samplesDirectory, '该内容暂时无法查看/01.html')],
  },
];

export function read(filepath: string) {
  return fs.readFileSync(filepath, 'utf8');
}

export function write(filepath: string, data: any) {
  const dir = path.dirname(filepath);
  fs.mkdirSync(dir, { recursive: true });

  fs.writeFileSync(filepath, data, 'utf8');
}
