import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  excelLoadCount: { value: 0 },
  excelRows: [] as Array<Record<string, unknown>>,
  saveAs: vi.fn(),
  writeBufferCalls: { value: 0 },
}));

vi.mock('file-saver', () => ({
  saveAs: mocks.saveAs,
}));

vi.mock('exceljs', () => {
  mocks.excelLoadCount.value += 1;

  class Workbook {
    xlsx = {
      writeBuffer: async () => {
        mocks.writeBufferCalls.value += 1;
        return new Uint8Array([1, 2, 3]).buffer;
      },
    };

    addWorksheet() {
      return {
        columns: [],
        addRow: (row: Record<string, unknown>) => mocks.excelRows.push(row),
      };
    }
  }

  return {
    default: { Workbook },
    Workbook,
  };
});

describe('exporter Excel dependency loading', () => {
  beforeEach(() => {
    vi.resetModules();
    mocks.excelLoadCount.value = 0;
    mocks.excelRows.length = 0;
    mocks.saveAs.mockClear();
    mocks.writeBufferCalls.value = 0;
  });

  it('keeps ExcelJS unloaded for JSON export paths', async () => {
    const { export2JsonFile, exportAccountJsonFile } = await import('~/utils/exporter');

    expect(mocks.excelLoadCount.value).toBe(0);

    await export2JsonFile([{ title: 'article', summary_enrichment: { schema: 'wcpt.summary_enrichment.v1' } } as any], 'articles');
    await exportAccountJsonFile({ accounts: [] } as any, 'accounts');

    expect(mocks.excelLoadCount.value).toBe(0);
    expect(mocks.saveAs).toHaveBeenCalledTimes(2);
    expect(mocks.saveAs.mock.calls.map(([, filename]) => filename)).toEqual(['articles.json', 'accounts.json']);
  });

  it('loads ExcelJS only when Excel export is selected', async () => {
    const { export2ExcelFile } = await import('~/utils/exporter');

    expect(mocks.excelLoadCount.value).toBe(0);

    await export2ExcelFile(
      [
        {
          _accountName: 'WCPT',
          aid: 'aid-1',
          appmsg_album_infos: [],
          cover: 'https://example.com/cover.png',
          create_time: 1_700_000_000,
          digest: 'digest',
          item_show_type: 5,
          link: 'https://mp.weixin.qq.com/s/example',
          title: 'Article title',
          update_time: 1_700_000_001,
        } as any,
      ],
      'articles'
    );

    expect(mocks.excelLoadCount.value).toBe(1);
    expect(mocks.writeBufferCalls.value).toBe(1);
    expect(mocks.excelRows).toHaveLength(1);
    expect(mocks.excelRows[0]).toMatchObject({
      _accountName: 'WCPT',
      aid: 'aid-1',
      link: 'https://mp.weixin.qq.com/s/example',
      title: 'Article title',
    });
    expect(mocks.saveAs).toHaveBeenCalledTimes(1);
    expect(mocks.saveAs.mock.calls[0][1]).toBe('articles.xlsx');
  });
});
