import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
}));

import { saveAs } from 'file-saver';
import { ExportStorageWriter, shouldUseDirectZip, splitExportPath } from '~/utils/download/exporter/storage';

const saveAsMock = vi.mocked(saveAs);

describe('export storage helpers', () => {
  beforeEach(() => {
    saveAsMock.mockClear();
  });

  it('decides direct ZIP mode from config and local hostnames', () => {
    expect(shouldUseDirectZip({ directZip: true, hostname: 'example.com' })).toBe(true);
    expect(shouldUseDirectZip({ directZip: false, hostname: 'localhost' })).toBe(false);
    expect(shouldUseDirectZip({ hostname: 'localhost' })).toBe(true);
    expect(shouldUseDirectZip({ hostname: '127.0.0.1' })).toBe(true);
    expect(shouldUseDirectZip({ hostname: 'export.example.com' })).toBe(false);
  });

  it('splits nested export paths into directories and filename', () => {
    expect(splitExportPath('/account/article/assets/cover.png')).toEqual({
      directories: ['account', 'article', 'assets'],
      filename: 'cover.png',
    });
  });

  it('writes ZIP fallback output and triggers a ZIP download', async () => {
    const writer = new ExportStorageWriter();

    await writer.prepare({
      directZip: true,
      runtime: {
        location: { hostname: 'export.example.com' },
      },
    });
    await writer.writeFile('account/article/index.html', new Blob(['<html></html>'], { type: 'text/html' }));
    await writer.flushZipDownload();

    expect(writer.mode).toBe('zip');
    expect(writer.getFallbackEvent()).toEqual({
      mode: 'zip',
      reason: '当前为本地/私有化访问，已跳过文件夹选择，完成后将直接下载 ZIP 压缩包',
    });
    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const [, filename] = saveAsMock.mock.calls[0];
    expect(filename).toMatch(/^wechat-article-export-\d{4}-\d{2}-\d{2}-\d{6}\.zip$/);
  });
});
