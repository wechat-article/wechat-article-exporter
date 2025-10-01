import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import type { AppMsgEx } from '~/types/types';
import type { ArticleMetadata } from '~/utils/download/types';
import { formatTimeStamp, ITEM_SHOW_TYPE } from '~/utils';

export type ExcelExportEntity = AppMsgEx &
  Partial<ArticleMetadata> & {
    content?: string;
    comments?: any[];
  };

// 导出为 excel 文件
export async function export2ExcelFile(data: ExcelExportEntity[], filename: string) {
  // 创建工作簿和工作表
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

  // 设置表头
  worksheet.columns = [
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
      item_show_type: ITEM_SHOW_TYPE[item.item_show_type],
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
