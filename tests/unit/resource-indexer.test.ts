import { describe, expect, it } from 'vitest';
import {
  collectArticleResourceUrls,
  collectBackgroundResourceUrls,
  createExportResourceRefs,
} from '~/utils/download/exporter/resourceIndexer';

type FakeElementOptions = {
  attrs?: Record<string, string | null>;
  href?: string;
};

function createElement(options: FakeElementOptions = {}) {
  return {
    href: options.href ?? '',
    getAttribute: (name: string) => options.attrs?.[name] ?? null,
  };
}

function createDocument(options: {
  imgs?: ReturnType<typeof createElement>[];
  links?: ReturnType<typeof createElement>[];
}) {
  return {
    querySelectorAll: (selector: string) => {
      if (selector === 'img') {
        return options.imgs ?? [];
      }
      if (selector === 'link[rel="stylesheet"]') {
        return options.links ?? [];
      }
      return [];
    },
  } as unknown as Pick<Document, 'querySelectorAll'>;
}

describe('resource indexer', () => {
  it('collects background image URLs from inline styles', () => {
    const html = `
      <section style="background-image: url(https://cdn.example.com/bg.png)"></section>
      <section style="background: url(&quot;//cdn.example.com/cover.jpg&quot;)"></section>
    `;

    expect(collectBackgroundResourceUrls(html)).toEqual([
      'https://cdn.example.com/bg.png',
      '//cdn.example.com/cover.jpg',
    ]);
  });

  it('collects image, stylesheet, and background resources in document order groups', () => {
    const document = createDocument({
      imgs: [
        createElement({ attrs: { src: 'https://cdn.example.com/a.png' } }),
        createElement({ attrs: { src: null, 'data-src': 'https://cdn.example.com/b.png' } }),
      ],
      links: [createElement({ href: 'https://cdn.example.com/app.css' })],
    });
    const html = '<main style="background-image: url(https://cdn.example.com/bg.png)"></main>';

    expect(collectArticleResourceUrls(html, document)).toEqual([
      'https://cdn.example.com/a.png',
      'https://cdn.example.com/b.png',
      'https://cdn.example.com/app.css',
      'https://cdn.example.com/bg.png',
    ]);
  });

  it('creates fakeid-bound resource refs without deduping current Exporter semantics', () => {
    expect(createExportResourceRefs(['a', 'a'], 'fakeid-1')).toEqual([
      { url: 'a', fakeid: 'fakeid-1' },
      { url: 'a', fakeid: 'fakeid-1' },
    ]);
  });
});
