import { saveAs } from 'file-saver';
import { formatItemShowType, formatTimeStamp } from '#shared/utils/helpers';
import type { AccountManifest } from '~/types/account';
import type { AppMsgEx } from '~/types/types';
import type { SummaryEnrichmentPayload } from '~/utils/download/exporter/summaryEnrichment';
import type { ArticleMetadata } from '~/utils/download/types';

export type ExcelExportEntity = AppMsgEx &
  Partial<ArticleMetadata> & {
    content?: string;
    comments?: any[];
    summary_enrichment?: SummaryEnrichmentPayload;
    _accountName: string | null;
  };

type ExcelWorksheet = {
  columns: Array<{
    header: string;
    key: string;
    width?: number;
  }>;
  addRow(row: Record<string, unknown>): void;
};

type ExcelWorkbook = {
  addWorksheet(name: string): ExcelWorksheet;
  xlsx: {
    writeBuffer(): Promise<BlobPart>;
  };
};

type ExcelRuntime = {
  Workbook: new () => ExcelWorkbook;
};

async function loadExcelRuntime(): Promise<ExcelRuntime> {
  const mod = await import('exceljs');
  return ((mod as unknown as { default?: ExcelRuntime }).default ?? mod) as unknown as ExcelRuntime;
}

// 导出为 excel 文件
export async function export2ExcelFile(data: ExcelExportEntity[], filename: string) {
  const ExcelJS = await loadExcelRuntime();

  // 创建工作簿和工作表
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  // 设置表头
  worksheet.columns = [
    { header: '公众号', key: '_accountName', width: 20 },
    { header: 'ID', key: 'aid', width: 20 },
    { header: '链接', key: 'link', width: 50 },
    { header: '标题', key: 'title', width: 80 },
    { header: '封面', key: 'cover', width: 50 },
    { header: '摘要', key: 'digest', width: 50 },
    { header: '创建时间', key: 'create_time', width: 20 },
    { header: '发布时间', key: 'update_time', width: 20 },
    { header: '阅读', key: 'readNum', width: 10 },
    { header: '点赞', key: 'oldLikeNum', width: 10 },
    { header: '分享', key: 'shareNum', width: 10 },
    { header: '喜欢', key: 'likeNum', width: 10 },
    { header: '留言', key: 'commentNum', width: 10 },
    { header: '作者', key: 'author_name', width: 20 },
    { header: '是否原创', key: 'copyright', width: 10 },
    { header: '文章类型', key: 'item_show_type', width: 20 },
    { header: '所属合集', key: 'album', width: 50 },
    { header: '文章内容', key: 'content' },
  ];

  // 添加数据
  data.forEach(item => {
    worksheet.addRow({
      _accountName: item._accountName,
      aid: item.aid,
      link: item.link,
      title: item.title,
      cover: item.pic_cdn_url_235_1 || item.pic_cdn_url_16_9 || item.cover_img || item.cover,
      digest: item.digest,
      create_time: formatTimeStamp(item.create_time),
      update_time: formatTimeStamp(item.update_time),
      readNum: item.readNum,
      oldLikeNum: item.oldLikeNum,
      shareNum: item.shareNum,
      likeNum: item.likeNum,
      commentNum: item.commentNum,
      author_name: item.author_name,
      copyright: item.copyright_stat === 1 && item.copyright_type === 1 ? '原创' : '',
      item_show_type: formatItemShowType(item.item_show_type),
      album: item.appmsg_album_infos.map(album => '#' + album.title).join(' '),
      content: item.content,
    });
  });

  // 导出为 Excel 文件
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/octet-stream' });
  saveAs(blob, `${filename}.xlsx`);
}

// 导出为 json 文件
export async function export2JsonFile(data: ExcelExportEntity[], filename: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
}

// 导出公众号数据
export async function exportAccountJsonFile(data: AccountManifest, filename: string) {
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  saveAs(blob, `${filename}.json`);
}
