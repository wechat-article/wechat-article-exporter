import { describe, expect, it, vi } from 'vitest';
import {
  buildNormalizedHtmlDocument,
  rewriteBackgroundResourceUrls,
} from '~/utils/download/exporter/htmlNormalizer';

describe('html normalizer helpers', () => {
  it('rewrites mapped background resource URLs to relative export paths', () => {
    const html = '<section style="background-image: url(https://cdn.example.com/bg.png)"></section>';
    const urlmap = new Map([['https://cdn.example.com/bg.png', 'assets/bg.png']]);

    expect(rewriteBackgroundResourceUrls(html, urlmap)).toBe(
      '<section style="background-image: url(./assets/bg.png)"></section>'
    );
  });

  it('keeps missing background resource URLs and reports them', () => {
    const html = '<section style="background: url(&quot;//cdn.example.com/cover.jpg&quot;)"></section>';
    const onMissing = vi.fn();

    expect(rewriteBackgroundResourceUrls(html, new Map(), onMissing)).toBe(html);
    expect(onMissing).toHaveBeenCalledWith('//cdn.example.com/cover.jpg');
  });

  it('builds the normalized article document shell', () => {
    const document = buildNormalizedHtmlDocument({
      title: 'Article Title',
      localLinks: '<link rel="stylesheet" href="assets/app.css">\n',
      bodyClass: 'rich_media_empty_extra body-class',
      pageContentHTML: '<div id="js_article">content</div>',
      jsArticleBottomBarHTML: '<div id="js_article_bottom_bar">bar</div>',
      commentHTML: '<section id="comments">comments</section>',
    });

    expect(document).toContain('<title>Article Title</title>');
    expect(document).toContain('<link rel="stylesheet" href="assets/app.css">');
    expect(document).toContain('<body class="rich_media_empty_extra body-class">');
    expect(document).toContain('<div id="js_article">content</div>');
    expect(document).toContain('<div id="js_article_bottom_bar">bar</div>');
    expect(document).toContain('<!-- 评论数据 -->');
    expect(document).toContain('<section id="comments">comments</section>');
  });
});
