import { describe, expect, it } from 'vitest';
import {
  decodeJsStringLiteral,
  extractBalancedJsLiteral,
  parseWechatJSObject,
} from '#shared/utils/js-literal';

describe('wechat JS literal helpers', () => {
  it('decodes JS string literals without script execution', () => {
    expect(decodeJsStringLiteral("'hello\\x20world\\n'")).toBe('hello world\n');
    expect(decodeJsStringLiteral('"quote: \\"ok\\""')).toBe('quote: "ok"');
  });

  it('parses WeChat object literals with JsDecode and numeric coercion', () => {
    const parsed = parseWechatJSObject<{
      base_resp: { ret: number; errmsg: string };
      title: string;
      category: Array<{ id: number; name: string }>;
    }>(`
      {
        base_resp: {
          ret: '0' * 1,
          errmsg: JsDecode('ok'),
        },
        title: JsDecode('A\\x26B'),
        category: [
          { id: '7' * 1, name: '素材管理' },
        ],
      }
    `);

    expect(parsed.base_resp.ret).toBe(0);
    expect(parsed.base_resp.errmsg).toBe('ok');
    expect(parsed.title).toBe('A&B');
    expect(parsed.category[0]).toEqual({ id: 7, name: '素材管理' });
  });

  it('does not rewrite decoded HTML/code content inside strings', () => {
    const parsed = parseWechatJSObject<{ content: string }>(`
      {
        content: JsDecode('<code>value={this.state.inputVal} name:\\x20<span style=\\x22color: #98c379;\\x22>\\x22text\\x22</span></code>'),
      }
    `);

    expect(parsed.content).toContain('value={this.state.inputVal}');
    expect(parsed.content).toContain('name: <span');
    expect(parsed.content).toContain('>"text"</span>');
  });

  it('extracts balanced object literals while ignoring strings and comments', () => {
    const source = `
      window.value = {
        text: 'brace } inside string',
        nested: [{ ok: true }],
        // ignored }
        more: 'value',
      };
    `;
    const objectStart = source.indexOf('{');

    expect(extractBalancedJsLiteral(source, objectStart)).toContain("text: 'brace } inside string'");
    expect(extractBalancedJsLiteral(source, objectStart)).toContain('nested: [{ ok: true }]');
  });
});
