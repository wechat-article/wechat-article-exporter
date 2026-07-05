import { describe, expect, it } from 'vitest';
import {
  ARTICLE_SUMMARY_CLIENT_MAX_CONTENT_CHARS,
  createArticleSummaryRequestInput,
  extractArticleSummaryTextFromHtml,
  normalizeArticleSummaryPlainText,
} from '~/composables/useArticleSummary';

describe('article summary client helpers', () => {
  it('extracts preferred article text from WeChat html without scripts or styles', () => {
    const html = `
      <html>
        <head><style>.x{color:red}</style><script>window.secret = true</script></head>
        <body>
          <div id="js_article">
            <h1 id="activity-name">示例标题</h1>
            <div id="js_content">
              <p>第一段介绍公众号归档。</p>
              <p>第二段介绍 DeepSeek mock 摘要。</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = extractArticleSummaryTextFromHtml(html);

    expect(text).toContain('第一段介绍公众号归档。');
    expect(text).toContain('第二段介绍 DeepSeek mock 摘要。');
    expect(text).not.toContain('window.secret');
    expect(text).not.toContain('color:red');
  });

  it('builds a bounded summary request payload with digest fallback', () => {
    const payload = createArticleSummaryRequestInput({
      title: '  DeepSeek   摘要  ',
      url: ' https://mp.weixin.qq.com/s/local ',
      digest: '  摘要候选   内容  ',
    });

    expect(payload).toEqual({
      title: 'DeepSeek 摘要',
      url: 'https://mp.weixin.qq.com/s/local',
      content: '摘要候选 内容',
    });
  });

  it('bounds plain text to the client maximum before request', () => {
    const text = normalizeArticleSummaryPlainText('x'.repeat(ARTICLE_SUMMARY_CLIENT_MAX_CONTENT_CHARS + 32));

    expect(text).toHaveLength(ARTICLE_SUMMARY_CLIENT_MAX_CONTENT_CHARS);
  });
});
