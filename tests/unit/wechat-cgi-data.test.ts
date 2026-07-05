import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseCgiDataNew } from '#shared/utils/html';

function listCgiDataNewSamples(dir: string): string[] {
  const result: string[] = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'output') {
        result.push(...listCgiDataNewSamples(fullPath));
      }
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.html')) {
      const html = fs.readFileSync(fullPath, 'utf8');
      if (html.includes('window.cgiDataNew =')) {
        result.push(fullPath);
      }
    }
  }

  return result.sort();
}

describe('wechat cgiDataNew parser', () => {
  it('parses cgiDataNew statically from article HTML', async () => {
    const html = `
      <script type="text/javascript" h5only>
        (function() {
          function JsDecode(str) { return str; }
          try {
            window.cgiDataNew = {
              base_resp: {
                ret: '0' * 1,
                errmsg: JsDecode('ok'),
              },
              title: JsDecode('A\\x26B'),
              bizuin: JsDecode('MzA='),
              item_show_type: '8' * 1,
              appmsg_album_infos: [
                { album_id: JsDecode('album-1'), title: JsDecode('专辑') },
              ],
            };
            window.afterAssignment = true;
          } catch (e) {}
        })();
      </script>
    `;

    const data = await parseCgiDataNew(html);

    expect(data.base_resp.ret).toBe(0);
    expect(data.base_resp.errmsg).toBe('ok');
    expect(data.title).toBe('A&B');
    expect(data.bizuin).toBe('MzA=');
    expect(data.item_show_type).toBe(8);
    expect(data.appmsg_album_infos[0]).toEqual({ album_id: 'album-1', title: '专辑' });
  });

  it('parses every existing cgiDataNew article sample without script execution', async () => {
    const samplePaths = listCgiDataNewSamples(path.resolve(process.cwd(), 'samples'));

    expect(samplePaths.length).toBeGreaterThanOrEqual(25);
    for (const samplePath of samplePaths) {
      const data = await parseCgiDataNew(fs.readFileSync(samplePath, 'utf8'));
      const relativePath = path.relative(process.cwd(), samplePath);

      expect(data, relativePath).toBeTruthy();
      expect(data.bizuin || data.link?.includes('__biz='), relativePath).toBeTruthy();
      expect(data.title, relativePath).toBeTruthy();
      expect(typeof data.item_show_type, relativePath).toBe('number');
    }
  }, 30000);
});
