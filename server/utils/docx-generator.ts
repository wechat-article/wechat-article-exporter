import * as fs from 'node:fs';
import * as path from 'node:path';
import * as cheerio from 'cheerio';
import dayjs from 'dayjs';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import TurndownService from 'turndown';
import { shouldSkipMpArticleUrl } from '#shared/utils';
import { RETRY_POLICY } from '~/config';
import { getPool } from '~/server/db/postgres';
import { notifyArticleAccessTooFrequent, waitRandomArticleFetchDelay } from '~/server/utils/article-fetch';
import { isArticleAccessTooFrequentMessage, isPolicyViolationMessage, validateHTMLContent } from '~/shared/utils/html';

// ==================== 支持的导出格式 ====================

export type AutoExportFormat = 'html' | 'txt' | 'markdown' | 'word' | 'json' | 'excel';

const VALID_FORMATS: AutoExportFormat[] = ['html', 'txt', 'markdown', 'word', 'json', 'excel'];

// 每篇文章单独生成文件的格式
const PER_ARTICLE_FORMATS: AutoExportFormat[] = ['html', 'txt', 'markdown', 'word'];
// 整个公众号汇总为单个文件的格式
const AGGREGATE_FORMATS: AutoExportFormat[] = ['json', 'excel'];

const FORMAT_EXT: Record<AutoExportFormat, string> = {
  html: '.html',
  txt: '.txt',
  markdown: '.md',
  word: '.docx',
  json: '.json',
  excel: '.xlsx',
};

// ==================== cgiData 解析 ====================

function extractCgiScript(html: string): string | null {
  const $ = cheerio.load(html);
  const scriptEl = $('script[type="text/javascript"][h5only]').filter((i, el) => {
    const content = $(el).html() || '';
    return content.includes('window.cgiDataNew = ');
  });
  if (scriptEl.length !== 1) return null;
  return scriptEl.html()?.trim() || null;
}

function parseCgiDataNewServer(html: string): any {
  const code = extractCgiScript(html);
  if (!code) return null;

  const sandbox: any = { window: {}, console: { log: () => {}, error: () => {} } };
  sandbox.window = sandbox;
  const func = new Function('window', code);
  func(sandbox.window);
  return sandbox.cgiDataNew || sandbox.window?.cgiDataNew;
}

// ==================== HTML 渲染（与客户端 shared/utils/renderer.ts 完全一致）====================

const ITEM_SHOW_TYPE = { 图片分享: 8, 文本分享: 10, 普通图文: 0 };

function extractTitle(cgiData: any): string {
  switch (cgiData.item_show_type) {
    case ITEM_SHOW_TYPE.图片分享:
    case ITEM_SHOW_TYPE.普通图文:
      return cgiData.title;
    case ITEM_SHOW_TYPE.文本分享:
      if (cgiData.text_page_info.is_user_title === 1) return cgiData.title;
      return '(无标题)';
    default:
      return '(unknown)';
  }
}

function extractContentHTML(cgiData: any): string {
  switch (cgiData.item_show_type) {
    case ITEM_SHOW_TYPE.图片分享:
      return renderContent_8(cgiData);
    case ITEM_SHOW_TYPE.文本分享:
      return renderContent_10(cgiData);
    case ITEM_SHOW_TYPE.普通图文:
      return renderContent_0(cgiData);
    default:
      return '(unknown)';
  }
}

function renderContent_8(cgiData: any): string {
  let textContent = cgiData.content_noencode.replace(/\n/g, '<br />');
  const regex = /(<a class="wx_img_refer_link" data-seq="(\d+)" data-refer="图\2" style="[^"]*">)(\s*图\2\s*)(<\/a>)/g;
  textContent = textContent.replace(regex, (match: any, openTag: any, number: any, content: any, closeTag: any) => {
    const newOpenTag = openTag.replace(/>$/, ` href="#图${number}">`);
    return newOpenTag + content + closeTag;
  });

  const pictureContent = cgiData.picture_page_info_list
    .map((item: any) => item.cdn_url.replace(/&amp;/g, '&'))
    .map(
      (url: string, idx: number) =>
        `<div class="picture_item" id="图${idx + 1}">
    <img class="picture_item_img" src="${url}" alt="图${idx + 1}" />
    <p class="picture_item_label">图${idx + 1}</p>
</div>`
    )
    .join('\n');

  return `<section class="item_show_type_8">
<p class="text_content">${textContent}</p>
<div class="picture_content">${pictureContent}</div>
</section>`;
}

function renderContent_10(cgiData: any): string {
  const textContent = cgiData.text_page_info.content_noencode.replace(/\n/g, '<br />');
  return `<section class="item_show_type_10">
<p class="text_content">${textContent}</p>
</section>`;
}

function renderContent_0(cgiData: any): string {
  let contentHTML = cgiData.content_noencode || '';
  const $ = cheerio.load(contentHTML, null, false);

  $('img[data-src]').each((i, elem) => {
    const $img = $(elem);
    const dataSrc = $img.attr('data-src');
    if (dataSrc) {
      $img.attr('src', dataSrc);
      $img.removeAttr('data-src');
      $img.attr('loading', 'eager');
    }
  });

  $('img[height]').each((i, elem) => {
    $(elem).removeAttr('height');
  });

  let modifiedContent = $.html();
  return `<section class="item_show_type_0">${modifiedContent}</section>`;
}

function renderMetaInfo(cgiData: any): string {
  return `<div class="__meta__">
    <span class="copyright">原创</span>
    <span class="author">${cgiData.author}</span>
    <span class="nick_name">${cgiData.nick_name}</span>
    <span class="create_time">${cgiData.create_time}</span>
    <span class="ip">${cgiData.ip_wording?.province_name || ''}</span>
</div>`;
}

interface ArticleMetadata {
  readNum: number;
  oldLikeNum: number;
  shareNum: number;
  likeNum: number;
  commentNum: number;
}

async function getMetadataFromDB(url: string): Promise<ArticleMetadata | null> {
  const pool = getPool();
  const res = await pool.query(`SELECT data FROM metadata WHERE url = $1`, [url]);
  if (res.rows.length === 0) return null;
  return res.rows[0].data as ArticleMetadata;
}

async function renderBottomBar(cgiData: any): Promise<string> {
  const metadata: ArticleMetadata = (await getMetadataFromDB(cgiData.link)) || {
    readNum: 0,
    oldLikeNum: 0,
    commentNum: 0,
    likeNum: 0,
    shareNum: 0,
  };

  return `<div class="__bottom-bar__">
<div class="left">
<img src="${cgiData.round_head_img}" alt="" style="width: 32px;height: 32px;margin-right: 8px;">
<span>${cgiData.nick_name}</span>
</div>

<div class="right">
<!--阅读量-->
<button class="sns_opr_btn">
<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3C!-- Icon from Lucide by Lucide Contributors - https://github.com/lucide-icons/lucide/blob/main/LICENSE --%3E%3Cg fill='none' stroke='%23888888' stroke-linecap='round' stroke-linejoin='round' stroke-width='2'%3E%3Cpath d='M2.062 12.348a1 1 0 0 1 0-.696a10.75 10.75 0 0 1 19.876 0a1 1 0 0 1 0 .696a10.75 10.75 0 0 1-19.876 0'/%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/g%3E%3C/svg%3E" alt="">
<span>${metadata.readNum || '阅读'}</span>
</button>
<!--点赞量-->
<button class="sns_opr_btn">
<img src="data:image/svg+xml,%3Csvg width='25' height='24' viewBox='0 0 25 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M16.154 6.797l-.177 2.758h4.009c1.346 0 2.359 1.385 2.155 2.763l-.026.148-1.429 6.743c-.212.993-1.02 1.713-1.977 1.783l-.152.006-13.707-.006c-.553 0-1-.448-1-1v-8.58a1 1 0 0 1 1-1h2.44l1.263-.03.417-.018.168-.015.028-.005c1.355-.315 2.39-2.406 2.58-4.276l.01-.16.022-.572.022-.276c.074-.707.3-1.54 1.08-1.883 2.054-.9 3.387 1.835 3.274 3.62zm-2.791-2.52c-.16.07-.282.294-.345.713l-.022.167-.019.224-.023.604-.014.204c-.253 2.486-1.615 4.885-3.502 5.324l-.097.018-.204.023-.181.012-.256.01v8.218l9.813.004.11-.003c.381-.028.72-.304.855-.709l.034-.125 1.422-6.708.02-.11c.099-.668-.354-1.308-.87-1.381l-.098-.007h-5.289l.26-4.033c.09-1.449-.864-2.766-1.594-2.446zM7.5 11.606l-.21.005-2.241-.001v8.181l2.45.001v-8.186z' fill='%23000'/%3E%3C/svg%3E" alt="">
<span>${metadata.oldLikeNum || '赞'}</span>
</button>
<!--转发量-->
<button class="sns_opr_btn">
<img src="data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E  %3Cg fill='none' fill-rule='evenodd'%3E    %3Cpath d='M0 0h24v24H0z'/%3E    %3Cpath fill='%23576B95' d='M13.707 3.288l7.171 7.103a1 1 0 0 1 .09 1.32l-.09.1-7.17 7.104a1 1 0 0 1-1.705-.71v-3.283c-2.338.188-5.752 1.57-7.527 5.9-.295.72-1.02.713-1.177-.22-1.246-7.38 2.952-12.387 8.704-13.294v-3.31a1 1 0 0 1 1.704-.71zm-.504 5.046l-1.013.16c-4.825.76-7.976 4.52-7.907 9.759l.007.287c1.594-2.613 4.268-4.45 7.332-4.787l1.581-.132v4.103l6.688-6.623-6.688-6.623v3.856z'/%3E  %3C/g%3E%3C/svg%3E" alt="">
<span>${metadata.shareNum || '分享'}</span>
</button>
<!--喜欢量-->
<button class="sns_opr_btn">
<img src="data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='24' height='24' viewBox='0 0 24 24'%3E  %3Cdefs%3E    %3Cpath id='a62bde5b-af55-42c8-87f2-e10e8a48baa0-a' d='M0 0h24v24H0z'/%3E  %3C/defs%3E  %3Cg fill='none' fill-rule='evenodd'%3E    %3Cmask id='a62bde5b-af55-42c8-87f2-e10e8a48baa0-b' fill='%23fff'%3E      %3Cuse xlink:href='%23a62bde5b-af55-42c8-87f2-e10e8a48baa0-a'/%3E    %3C/mask%3E    %3Cg mask='url(%23a62bde5b-af55-42c8-87f2-e10e8a48baa0-b)'%3E      %3Cg transform='translate(0 -2.349)'%3E        %3Cpath d='M0 2.349h24v24H0z'/%3E        %3Cpath fill='%23576B95' d='M16.45 7.68c-.954 0-1.94.362-2.77 1.113l-1.676 1.676-1.853-1.838a3.787 3.787 0 0 0-2.63-.971 3.785 3.785 0 0 0-2.596 1.112 3.786 3.786 0 0 0-1.113 2.687c0 .97.368 1.938 1.105 2.679l7.082 6.527 7.226-6.678a3.787 3.787 0 0 0 .962-2.618 3.785 3.785 0 0 0-1.112-2.597A3.687 3.687 0 0 0 16.45 7.68zm3.473.243a4.985 4.985 0 0 1 1.464 3.418 4.98 4.98 0 0 1-1.29 3.47l-.017.02-7.47 6.903a.9.9 0 0 1-1.22 0l-7.305-6.73-.008-.01a4.986 4.986 0 0 1-1.465-3.535c0-1.279.488-2.56 1.465-3.536A4.985 4.985 0 0 1 7.494 6.46c1.24-.029 2.49.4 3.472 1.29l.01.01L12 8.774l.851-.85.01-.01c1.046-.951 2.322-1.434 3.59-1.434 1.273 0 2.52.49 3.472 1.442z'/%3E      %3C/g%3E    %3C/g%3E  %3C/g%3E%3C/svg%3E" alt="">
<span>${metadata.likeNum || '推荐'}</span>
</button>
<!--评论量-->
<button class="sns_opr_btn">
<img src="data:image/svg+xml,%3Csvg width='25' height='24' viewBox='0 0 25 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M22.242 7a2.5 2.5 0 0 0-2.5-2.5h-14a2.5 2.5 0 0 0-2.5 2.5v8.5a2.5 2.5 0 0 0 2.5 2.5h2.5v1.59a1 1 0 0 0 1.707.7l1-1a.569.569 0 0 0 .034-.03l1.273-1.273a.6.6 0 0 0-.8-.892v-.006L9.441 19.1l.001-2.3h-3.7l-.133-.007A1.3 1.3 0 0 1 4.442 15.5V7l.007-.133A1.3 1.3 0 0 1 5.742 5.7h14l.133.007A1.3 1.3 0 0 1 21.042 7v4.887a.6.6 0 1 0 1.2 0V7z' fill='%23000' fill-opacity='.9'/%3E%3Crect x='14.625' y='16.686' width='7' height='1.2' rx='.6' fill='%23000' fill-opacity='.9'/%3E%3Crect x='18.725' y='13.786' width='7' height='1.2' rx='.6' transform='rotate(90 18.725 13.786)' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E" alt="">
<span>${metadata.commentNum || '留言'}</span>
</button>
</div>
</div>`;
}

/**
 * 渲染完整 HTML —— 与客户端 shared/utils/renderer.ts 的 renderHTMLFromCgiDataNew 保持一致
 */
async function renderHTMLFromCgiData(cgiData: any): Promise<string> {
  const title = extractTitle(cgiData);
  const meta = renderMetaInfo(cgiData);
  const contentHTML = extractContentHTML(cgiData);
  const bottomBarHTML = await renderBottomBar(cgiData);

  return `<!DOCTYPE html>
<html lang="zh_CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
    <meta name="referrer" content="no-referrer">
    <title>${title}</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            outline: 0;
        }
        body {
            font-family: "PingFang SC", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
            line-height: 1.6;
        }
        .__page_content__ {
            max-width: 667px;
            margin: 0 auto;
            padding: 20px;
            text-size-adjust: 100%;
            color: rgba(0, 0, 0, 0.9);
            padding-bottom: 64px;
        }
        .title {
            user-select: text;
            font-size: 22px;
            line-height: 1.4;
            margin-bottom: 14px;
            font-weight: 500;
        }
        .__meta__ {
            color: rgba(0, 0, 0, 0.3);
            font-size: 15px;
            line-height: 20px;
            hyphens: auto;
            word-break: break-word;
            margin-bottom: 50px;
        }
        .__meta__ .nick_name {
            color: #576B95;
        }
        .__meta__ .copyright {
            color: rgba(0, 0, 0, 0.3);
            background-color: rgba(0, 0, 0, 0.05);
            padding: 0 4px;
            margin: 0 10px 10px 0;
        }
        blockquote.source {
            padding: 10px;
            margin: 30px 0;
            border-left: 5px solid #ccc;
            color: #333;
            font-style: italic;
            word-wrap: break-word;
        }
        blockquote.source a {
            cursor: pointer;
            text-decoration: underline;
        }
        .item_show_type_0 > section {
            margin-top: 0;
            margin-bottom: 24px;
        }
        a {
            color: #576B95;
            text-decoration: none;
            cursor: default;
        }
        .text_content {
            margin-bottom: 50px;
            user-select: text;
            font-size: 17px;
            white-space: pre-wrap;
            word-wrap: break-word;
            line-height: 28px;
            hyphens: auto;
        }
        .picture_content .picture_item {
            margin-bottom: 30px;
        }
        .picture_content .picture_item .picture_item_label {
            text-align: center;
        }
        img {
            max-width: 100%;
        }
        .__bottom-bar__ {
            display: flex;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            height: 64px;
            padding: 8px 20px;
            background: white;
            box-sizing: border-box;
            border-top: 1px solid rgba(0, 0, 0, 0.2);
        }
        .__bottom-bar__ .left {
            display: flex;
            align-items: center;
            font-size: 15px;
            white-space: nowrap;
        }
        .__bottom-bar__ .right {
            display: flex;
        }
        .__bottom-bar__ .sns_opr_btn {
            display: flex;
            align-items: center;
            user-select: none;
            background: transparent;
            border: 0;
            color: rgba(0, 0, 0, 0.9);
            font-size: 14px;
        }
        .__bottom-bar__ .sns_opr_btn:not(:last-child) {
            margin-right: 16px;
        }
        .__bottom-bar__ .sns_opr_btn > img {
            margin-right: 4px;
        }
    </style>
</head>
<body>
<div class="__page_content__">
<h1 class="title">${title}</h1>
${meta}
<blockquote class="source">原文地址: <a href="${cgiData.link}">${cgiData.link}</a></blockquote>
${contentHTML}

${bottomBarHTML}
</div>
</body>
</html>`;
}

// ==================== DOCX 生成（复刻 html-docx-js 的 OOXML + MHT 格式）====================

// [Content_Types].xml
const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType=
    "application/vnd.openxmlformats-package.relationships+xml" />
  <Override PartName="/word/document.xml" ContentType=
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/afchunk.mht" ContentType="message/rfc822"/>
</Types>`;

// _rels/.rels
const ROOT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship
      Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
      Target="/word/document.xml" Id="R09c83fafc067488e" />
</Relationships>`;

// word/_rels/document.xml.rels
const DOC_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk"
    Target="/word/afchunk.mht" Id="htmlChunk" />
</Relationships>`;

// word/document.xml
function renderDocumentXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
  xmlns:ns6="http://schemas.openxmlformats.org/schemaLibrary/2006/main"
  xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"
  xmlns:ns8="http://schemas.openxmlformats.org/drawingml/2006/chartDrawing"
  xmlns:dgm="http://schemas.openxmlformats.org/drawingml/2006/diagram"
  xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"
  xmlns:ns11="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing"
  xmlns:dsp="http://schemas.microsoft.com/office/drawing/2008/diagram"
  xmlns:ns13="urn:schemas-microsoft-com:office:excel"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:ns17="urn:schemas-microsoft-com:office:powerpoint"
  xmlns:odx="http://opendope.org/xpaths"
  xmlns:odc="http://opendope.org/conditions"
  xmlns:odq="http://opendope.org/questions"
  xmlns:odi="http://opendope.org/components"
  xmlns:odgm="http://opendope.org/SmartArt/DataHierarchy"
  xmlns:ns24="http://schemas.openxmlformats.org/officeDocument/2006/bibliography"
  xmlns:ns25="http://schemas.openxmlformats.org/drawingml/2006/compatibility"
  xmlns:ns26="http://schemas.openxmlformats.org/drawingml/2006/lockedCanvas">
  <w:body>
    <w:altChunk r:id="htmlChunk" />
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840" w:orient="portrait" />
      <w:pgMar w:top="1440"
               w:right="1440"
               w:bottom="1440"
               w:left="1440"
               w:header="720"
               w:footer="720"
               w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

/**
 * 将 HTML 转为 MHT 格式（与 html-docx-js 的 getMHTdocument 逻辑一致）
 * - 提取 data:image 内联图片为独立 MHT part
 * - HTML 内容使用 quoted-printable 编码（= 替换为 =3D）
 */
function getMHTdocument(htmlSource: string): string {
  const imageContentParts: string[] = [];
  const inlinedSrcPattern = /"data:(\w+\/\w+);(\w+),(\S+)"/g;

  let index = 0;
  htmlSource = htmlSource.replace(inlinedSrcPattern, (match, contentType, contentEncoding, encodedContent) => {
    const extension = contentType.split('/')[1];
    const contentLocation = `file:///C:/fake/image${index}.${extension}`;
    index++;
    imageContentParts.push(
      `------=mhtDocumentPart\nContent-Type: ${contentType}\nContent-Transfer-Encoding: ${contentEncoding}\nContent-Location: ${contentLocation}\n\n${encodedContent}\n`
    );
    return `"${contentLocation}"`;
  });

  // quoted-printable: 将 = 替换为 =3D
  htmlSource = htmlSource.replace(/=/g, '=3D');

  return `MIME-Version: 1.0\nContent-Type: multipart/related;\n    type="text/html";\n    boundary="----=mhtDocumentPart"\n\n\n------=mhtDocumentPart\nContent-Type: text/html;\n    charset="utf-8"\nContent-Transfer-Encoding: quoted-printable\nContent-Location: file:///C:/fake/document.html\n\n${htmlSource}\n\n${imageContentParts.join('\n')}\n\n------=mhtDocumentPart--\n`;
}

/**
 * 使用 JSZip 生成与 html-docx-js 完全一致的 .docx 文件
 */
async function htmlToDocxBuffer(html: string): Promise<Buffer> {
  const zip = new JSZip();

  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.folder('_rels')!.file('.rels', ROOT_RELS_XML);

  const wordFolder = zip.folder('word')!;
  wordFolder.file('document.xml', renderDocumentXml());
  wordFolder.file('afchunk.mht', getMHTdocument(html));
  wordFolder.folder('_rels')!.file('document.xml.rels', DOC_RELS_XML);

  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>;
}

// ==================== TXT 生成 ====================

function renderTextFromCgiData(cgiData: any): string {
  const title = extractTitle(cgiData);
  let text = '';
  switch (cgiData.item_show_type) {
    case ITEM_SHOW_TYPE.普通图文: {
      const $ = cheerio.load(cgiData.content_noencode || '', null, false);
      text = $.text();
      break;
    }
    case ITEM_SHOW_TYPE.图片分享:
      text = cgiData.content_noencode || '';
      break;
    case ITEM_SHOW_TYPE.文本分享:
      text = cgiData.text_page_info?.content_noencode || '';
      break;
    default:
      break;
  }
  return `${title}\n\n${text.trim()}`;
}

// ==================== Markdown 生成 ====================

const turndownService = new TurndownService();

// ==================== 文件名和目录 ====================

function filterInvalidFilenameChars(input: string): string {
  const regex = /[^\u4e00-\u9fa5a-zA-Z0-9()（）]/g;
  return input.replace(regex, '_').slice(0, 100).trim();
}

export function getDocxOutputDir(): string | null {
  return process.env.AUTO_EXPORT_DIR || process.env.DOCX_OUTPUT_DIR || null;
}

export function getAutoExportFormats(): AutoExportFormat[] {
  const raw = process.env.AUTO_EXPORT_FORMATS || 'word';
  return raw
    .split(',')
    .map((s) => s.trim().toLowerCase() as AutoExportFormat)
    .filter((f) => VALID_FORMATS.includes(f));
}

// ==================== 主逻辑 ====================

function validateFetchedHtml(html: string): {
  status: 'Success' | 'Deleted' | 'Exception' | 'Error';
  reason: string;
  retryable: boolean;
  skip: boolean;
  notify: boolean;
} {
  const [status, msg] = validateHTMLContent(html);
  if (status === 'Deleted') {
    return { status, reason: msg || '该内容已被发布者删除', retryable: false, skip: true, notify: false };
  }
  if (status === 'Exception') {
    if (isPolicyViolationMessage(msg)) {
      return { status, reason: msg || '此内容因违规无法查看', retryable: false, skip: true, notify: false };
    }
    if (isArticleAccessTooFrequentMessage(msg)) {
      return {
        status,
        reason: msg || '访问过于频繁，请用微信扫描二维码进行访问',
        retryable: false,
        skip: false,
        notify: true,
      };
    }
    return { status, reason: msg || '内容异常', retryable: true, skip: false, notify: false };
  }
  if (status === 'Error') {
    return { status, reason: '页面结构异常', retryable: true, skip: false, notify: false };
  }
  return { status, reason: '', retryable: false, skip: false, notify: false };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface AutoExportResult {
  total: number;
  generated: number;
  skipped: number;
  failed: number;
  formats: AutoExportFormat[];
  errors: string[];
}

// 保留旧名称兼容
export type AutoDocxResult = AutoExportResult;

export type ExportSource = 'auto-export' | 'schedule' | 'manual-sync' | 'interface-sync';

export interface ArticleExportProgress {
  accountName: string;
  title: string;
  url: string;
  index: number;
  total: number;
}

export interface ArticleExportRetryProgress {
  stage: 'exporting';
  scope: 'article-fetch' | 'cgi-parse';
  accountName: string;
  title: string;
  url: string;
  index: number;
  total: number;
  attempt: number;
  maxAttempts: number;
  delayMs: number;
  message: string;
}

interface GenerateDocxInternalOptions {
  source: ExportSource;
  syncToTimestamp?: number;
  articleUrls?: string[];
  formats?: AutoExportFormat[];
  onArticleStart?: (progress: ArticleExportProgress) => void | Promise<void>;
  onRetry?: (progress: ArticleExportRetryProgress) => void | Promise<void>;
  isCancelled?: () => boolean;
}

function assertNotCancelled(isCancelled?: () => boolean) {
  if (isCancelled?.()) {
    throw new Error('cancelled');
  }
}

function createEmptyExportResult(formats: AutoExportFormat[]): AutoExportResult {
  return {
    total: 0,
    generated: 0,
    skipped: 0,
    failed: 0,
    formats,
    errors: [],
  };
}

async function queryArticlesForExport(pool: ReturnType<typeof getPool>, fakeid: string, options: GenerateDocxInternalOptions) {
  if (options.articleUrls && options.articleUrls.length > 0) {
    const articleUrls = [...new Set(options.articleUrls.filter(Boolean))];
    if (articleUrls.length === 0) {
      return [];
    }

    const res = await pool.query(
      `SELECT data, array_position($2::text[], link) AS sort_order
       FROM article
       WHERE fakeid = $1 AND link = ANY($2::text[])
       ORDER BY sort_order ASC NULLS LAST, COALESCE(update_time, create_time) DESC`,
      [fakeid, articleUrls]
    );
    return res.rows.map((row: any) => row.data);
  }

  if (options.syncToTimestamp) {
    const res = await pool.query(
      `SELECT data FROM article WHERE fakeid = $1 AND COALESCE(update_time, create_time) >= $2 ORDER BY COALESCE(update_time, create_time) DESC`,
      [fakeid, options.syncToTimestamp]
    );
    return res.rows.map((row: any) => row.data);
  }

  const res = await pool.query(
    `SELECT data FROM article WHERE fakeid = $1 ORDER BY COALESCE(update_time, create_time) DESC`,
    [fakeid]
  );
  return res.rows.map((row: any) => row.data);
}

async function generateDocxForAccountInternal(fakeid: string, options: GenerateDocxInternalOptions): Promise<AutoExportResult> {
  const outputDir = getDocxOutputDir();
  if (!outputDir) {
    throw new Error('AUTO_EXPORT_DIR 环境变量未配置');
  }

  const formats = options.formats || getAutoExportFormats();
  if (formats.length === 0) {
    throw new Error('AUTO_EXPORT_FORMATS 未配置有效格式（支持: html,txt,markdown,word,json,excel）');
  }

  const pool = getPool();
  const result = createEmptyExportResult(formats);

  const tag = `[${options.source}]`;

  console.log(`${tag} 公众号：【${fakeid}】开始生成文件，格式: [${formats.join(',')}]，输出目录: ${outputDir}`);
  assertNotCancelled(options.isCancelled);

  // 1. 获取公众号名称
  const infoRes = await pool.query(`SELECT nickname FROM info WHERE fakeid = $1`, [fakeid]);
  const accountName = infoRes.rows.length > 0 ? (infoRes.rows[0].nickname || fakeid) : fakeid;
  const safeDirName = filterInvalidFilenameChars(accountName);
  console.log(`${tag} 公众号：【${accountName}】目录名: ${safeDirName}`);

  // 2. 获取该公众号的所有文章（如果有时间范围限制则过滤）
  const articles = await queryArticlesForExport(pool, fakeid, options);
  result.total = articles.length;
  const syncInfo = options.articleUrls?.length
    ? `（本批 ${articles.length} 篇）`
    : options.syncToTimestamp
      ? `（过滤: >= ${new Date(options.syncToTimestamp * 1000).toLocaleDateString()}）`
      : '（全部）';
  console.log(`${tag} 公众号：【${accountName}】查询到 ${articles.length} 篇文章${syncInfo}（数据来自本地数据库）`);
  assertNotCancelled(options.isCancelled);

  // 3. 确保输出目录存在
  const accountDir = path.resolve(outputDir, safeDirName);
  fs.mkdirSync(accountDir, { recursive: true });
  console.log(`${tag} 公众号：【${accountName}】输出目录已就绪: ${accountDir}`);

  // 4. 区分逐篇格式和汇总格式
  const perArticleFormats = formats.filter((f) => PER_ARTICLE_FORMATS.includes(f));
  const aggregateFormats = formats.filter((f) => AGGREGATE_FORMATS.includes(f));

  // 5. 逐篇文章生成（html/txt/markdown/word）
  const failedUrls: { title: string; url: string; reason: string }[] = [];

  if (perArticleFormats.length > 0) {
    for (let articleIndex = 0; articleIndex < articles.length; articleIndex++) {
      assertNotCancelled(options.isCancelled);

      const article = articles[articleIndex];
      const title = article.title || '无标题';
      const url = article.link;
      if (!url) {
        result.failed++;
        result.errors.push(`无链接: ${title}`);
        console.error(`${tag} 公众号：【${accountName}】文章无链接，跳过: ${title}，article keys: ${Object.keys(article).join(', ')}`);
        continue;
      }
      if (shouldSkipMpArticleUrl(url)) {
        result.skipped++;
        console.log(`${tag} 公众号：【${accountName}】跳过不支持的链接: ${title} | ${url}`);
        continue;
      }

      const articleTime = article.update_time || article.create_time;
      const articleDate = articleTime
        ? new Date(articleTime * 1000).toLocaleDateString()
        : '未知';
      const dateSuffix = articleTime
        ? dayjs.unix(articleTime).format('YYYY-MM-DD')
        : 'unknown';
      const safeTitle = filterInvalidFilenameChars(title);
      const fileBaseName = `${dateSuffix}-${safeTitle}`;

      console.log(`${tag} 公众号：【${accountName}】 [${articleIndex + 1}/${articles.length}] 处理文章: ${title} (${articleDate}) | ${url}`);

      // 检查是否所有格式的文件都已存在
      const missingFormats = perArticleFormats.filter((fmt) => {
        const filePath = path.join(accountDir, `${fileBaseName}${FORMAT_EXT[fmt]}`);
        return !fs.existsSync(filePath);
      });

      if (missingFormats.length === 0) {
        result.skipped++;
        console.log(`${tag} 公众号：【${accountName}】跳过已存在（全部格式）: ${fileBaseName}`);
        continue;
      }

      await options.onArticleStart?.({
        accountName,
        title,
        url,
        index: articleIndex + 1,
        total: articles.length,
      });

      // 获取原始 HTML 内容（带重试逻辑）
      let rawHtml: string | null = null;
      let cgiData: any = null;
      let skippedDuringParseRetry = false;
      let skipReason: string | null = null;
      let lastFailureReason: string | null = null;

      // 从 html 表获取已缓存的 HTML 内容
      const htmlRes = await pool.query(`SELECT file, file_type FROM html WHERE url = $1`, [url]);
      if (htmlRes.rows.length > 0 && htmlRes.rows[0].file) {
        const fileBuffer: Buffer = htmlRes.rows[0].file;
        rawHtml = fileBuffer.toString('utf-8');
        const cachedHtmlStatus = validateFetchedHtml(rawHtml);
        if (cachedHtmlStatus.skip) {
          result.skipped++;
          console.log(`${tag} 公众号：【${accountName}】跳过不可导出文章: ${title} — ${cachedHtmlStatus.reason} | ${url}`);
          continue;
        }
        if (cachedHtmlStatus.notify) {
          lastFailureReason = cachedHtmlStatus.reason;
          await notifyArticleAccessTooFrequent({
            source: 'docx-generator-cache',
            accountName,
            title,
            url,
            reason: cachedHtmlStatus.reason,
          });
          rawHtml = null;
        }
        if (cachedHtmlStatus.retryable) {
          lastFailureReason = cachedHtmlStatus.reason;
          rawHtml = null;
        }
      }

      // 如果没有缓存，尝试在线抓取（带重试）
      if (!rawHtml) {
        console.log(`${tag} 公众号：【${accountName}】HTML 缓存不存在，尝试在线抓取: ${title} | ${url}`);
        for (let attempt = 0; attempt <= RETRY_POLICY.articleExport.retries; attempt++) {
          assertNotCancelled(options.isCancelled);
          if (attempt > 0) {
            const retryMessage = `正在重试抓取第 ${articleIndex + 1}/${articles.length} 篇《${title}》，第 ${attempt}/${RETRY_POLICY.articleExport.retries} 次`;
            console.warn(`${tag} 公众号：【${accountName}】${retryMessage}，${RETRY_POLICY.articleExport.delayMs / 1000} 秒后继续 | ${url}`);
            await options.onRetry?.({
              stage: 'exporting',
              scope: 'article-fetch',
              accountName,
              title,
              url,
              index: articleIndex + 1,
              total: articles.length,
              attempt,
              maxAttempts: RETRY_POLICY.articleExport.retries,
              delayMs: RETRY_POLICY.articleExport.delayMs,
              message: retryMessage,
            });
            await delay(RETRY_POLICY.articleExport.delayMs);
          }
          try {
            const fetchedHtml = await fetchArticleHtml(url, `公众号：【${accountName}】《${title}》`);
            if (!fetchedHtml) {
              continue;
            }

            const fetchedHtmlStatus = validateFetchedHtml(fetchedHtml);
            if (fetchedHtmlStatus.skip) {
              skipReason = fetchedHtmlStatus.reason;
              rawHtml = fetchedHtml;
              break;
            }
            if (fetchedHtmlStatus.notify) {
              lastFailureReason = fetchedHtmlStatus.reason;
              await notifyArticleAccessTooFrequent({
                source: 'docx-generator',
                accountName,
                title,
                url,
                reason: fetchedHtmlStatus.reason,
              });
              break;
            }
            if (fetchedHtmlStatus.retryable) {
              lastFailureReason = fetchedHtmlStatus.reason;
              continue;
            }

            rawHtml = fetchedHtml;
            break;
          } catch (e: any) {
            console.error(`${tag} 公众号：【${accountName}】抓取异常（第 ${attempt + 1} 次）: ${title} - ${e.message} | ${url}`);
          }
        }
        if (skipReason) {
          result.skipped++;
          console.log(`${tag} 公众号：【${accountName}】跳过不可导出文章: ${title} — ${skipReason} | ${url}`);
          continue;
        }
        if (!rawHtml) {
          result.failed++;
          const reason = lastFailureReason ? `抓取失败（已重试）: ${lastFailureReason}` : '抓取失败（已重试）';
          result.errors.push(`${reason}: ${title} | ${url}`);
          failedUrls.push({ title, url, reason });
          console.error(`${tag} 公众号：【${accountName}】在线抓取 HTML 最终失败: ${title} | ${url}`);
          continue;
        }
      }

      // 解析 cgiData（带重试：可能网络抓取到的是临时错误页面）
      cgiData = parseCgiDataNewServer(rawHtml);
      if (!cgiData && rawHtml) {
        lastFailureReason = '解析 cgiData 失败';
        // cgiData 解析失败，尝试重新抓取
        for (let attempt = 1; attempt <= RETRY_POLICY.articleExport.retries; attempt++) {
          assertNotCancelled(options.isCancelled);
          const retryMessage = `正在重试解析第 ${articleIndex + 1}/${articles.length} 篇《${title}》，第 ${attempt}/${RETRY_POLICY.articleExport.retries} 次`;
          console.warn(`${tag} 公众号：【${accountName}】${retryMessage}，${RETRY_POLICY.articleExport.delayMs / 1000} 秒后继续 | ${url}`);
          await options.onRetry?.({
            stage: 'exporting',
            scope: 'cgi-parse',
            accountName,
            title,
            url,
            index: articleIndex + 1,
            total: articles.length,
            attempt,
            maxAttempts: RETRY_POLICY.articleExport.retries,
            delayMs: RETRY_POLICY.articleExport.delayMs,
            message: retryMessage,
          });
          await delay(RETRY_POLICY.articleExport.delayMs);
          try {
            const retryHtml = await fetchArticleHtml(url, `公众号：【${accountName}】《${title}》重试`);
            if (!retryHtml) {
              continue;
            }

            const retryHtmlStatus = validateFetchedHtml(retryHtml);
            if (retryHtmlStatus.skip) {
              result.skipped++;
              skippedDuringParseRetry = true;
              console.log(`${tag} 公众号：【${accountName}】重试后发现不可导出文章: ${title} — ${retryHtmlStatus.reason} | ${url}`);
              break;
            }
            if (retryHtmlStatus.notify) {
              lastFailureReason = retryHtmlStatus.reason;
              await notifyArticleAccessTooFrequent({
                source: 'docx-generator-parse-retry',
                accountName,
                title,
                url,
                reason: retryHtmlStatus.reason,
              });
              break;
            }
            if (retryHtmlStatus.retryable) {
              lastFailureReason = retryHtmlStatus.reason;
              continue;
            }

            cgiData = parseCgiDataNewServer(retryHtml);
            rawHtml = retryHtml;
            if (cgiData) {
              break;
            }
          } catch (e: any) {
            console.error(`${tag} 公众号：【${accountName}】重试抓取异常（第 ${attempt} 次）: ${title} - ${e.message} | ${url}`);
          }
        }
      }

      if (skippedDuringParseRetry) {
        continue;
      }

      if (!cgiData) {
        result.failed++;
        const reason = lastFailureReason ? `解析 cgiData 失败（已重试）: ${lastFailureReason}` : '解析 cgiData 失败（已重试）';
        result.errors.push(`${reason}: ${title} | ${url}`);
        failedUrls.push({ title, url, reason });
        console.error(`${tag} 公众号：【${accountName}】解析 cgiData 最终失败: ${title} | ${url}`);
        continue;
      }

      // 按需生成各格式（缓存渲染结果）
      let renderedHtml: string | null = null;
      let articleGenerated = false;

      for (const fmt of missingFormats) {
        assertNotCancelled(options.isCancelled);
        const filePath = path.join(accountDir, `${fileBaseName}${FORMAT_EXT[fmt]}`);
        try {
          const buf = await convertToFormat(fmt, cgiData, () => renderedHtml, async (html) => { renderedHtml = html; });
          fs.writeFileSync(filePath, buf);
          articleGenerated = true;
          console.log(`${tag} 公众号：【${accountName}】生成成功: ${fileBaseName}${FORMAT_EXT[fmt]}`);
        } catch (e: any) {
          result.errors.push(`[${fmt}] ${title}: ${e.message} | ${url}`);
          console.error(`${tag} 公众号：【${accountName}】生成 ${fmt} 异常: ${title} | ${url}`);
          console.error(`${tag}   错误: ${e.message}`);
          console.error(`${tag}   堆栈:`, e.stack);
        }
      }

      if (articleGenerated) {
        result.generated++;
      } else {
        result.failed++;
        failedUrls.push({ title, url, reason: '所有格式生成失败' });
      }
    }
  }

  // 6. 汇总格式导出（json/excel）— 每个公众号生成一个汇总文件
  if (aggregateFormats.length > 0) {
    assertNotCancelled(options.isCancelled);

    // 构建导出数据：文章 + 元数据
    const exportEntities: any[] = [];
    for (const article of articles) {
      assertNotCancelled(options.isCancelled);
      const url = article.link;
      let metadata: ArticleMetadata | null = null;
      if (url) {
        metadata = await getMetadataFromDB(url);
      }
      exportEntities.push({
        ...article,
        _accountName: accountName,
        readNum: metadata?.readNum ?? 0,
        oldLikeNum: metadata?.oldLikeNum ?? 0,
        shareNum: metadata?.shareNum ?? 0,
        likeNum: metadata?.likeNum ?? 0,
        commentNum: metadata?.commentNum ?? 0,
      });
    }

    for (const fmt of aggregateFormats) {
      assertNotCancelled(options.isCancelled);
      const filePath = path.join(accountDir, `${safeDirName}${FORMAT_EXT[fmt]}`);
      // 汇总文件每次同步都重新生成（数据可能有更新）
      try {
        if (fmt === 'json') {
          const jsonStr = JSON.stringify(exportEntities, null, 2);
          fs.writeFileSync(filePath, jsonStr, 'utf-8');
          console.log(`${tag} 公众号：【${accountName}】JSON 汇总生成成功: ${safeDirName}${FORMAT_EXT[fmt]}（${exportEntities.length} 篇）`);
        } else if (fmt === 'excel') {
          const buf = await generateExcelBuffer(exportEntities);
          fs.writeFileSync(filePath, buf);
          console.log(`${tag} 公众号：【${accountName}】Excel 汇总生成成功: ${safeDirName}${FORMAT_EXT[fmt]}（${exportEntities.length} 篇）`);
        }
      } catch (e: any) {
        result.errors.push(`[${fmt}] 汇总文件: ${e.message}`);
        console.error(`${tag} 公众号：【${accountName}】生成 ${fmt} 汇总文件异常`);
        console.error(`${tag}   错误: ${e.message}`);
        console.error(`${tag}   堆栈:`, e.stack);
      }
    }
  }

  // 打印失败 URL 列表
  if (failedUrls.length > 0) {
    console.error(`${tag} 公众号：【${accountName}】失败文章列表（共 ${failedUrls.length} 篇）:`);
    for (const item of failedUrls) {
      console.error(`${tag}   - [${item.reason}] ${item.title}`);
      console.error(`${tag}     ${item.url}`);
    }
  }

  console.log(`${tag} 公众号：【${accountName}】处理完成 — 总计: ${result.total}, 生成: ${result.generated}, 跳过: ${result.skipped}, 失败: ${result.failed}, 格式: [${formats.join(',')}]`);
  return result;
}

export async function generateDocxForAccount(fakeid: string, syncToTimestamp?: number, source: 'auto-export' | 'schedule' = 'auto-export'): Promise<AutoExportResult> {
  return generateDocxForAccountInternal(fakeid, {
    source,
    syncToTimestamp,
  });
}

export async function generateDocxForArticleUrls(
  fakeid: string,
  articleUrls: string[],
  source: ExportSource = 'manual-sync',
  onArticleStart?: (progress: ArticleExportProgress) => void | Promise<void>,
  isCancelled?: () => boolean,
  onRetry?: (progress: ArticleExportRetryProgress) => void | Promise<void>,
): Promise<AutoExportResult> {
  const formats = getAutoExportFormats().filter((format) => PER_ARTICLE_FORMATS.includes(format));
  if (formats.length === 0) {
    const result = createEmptyExportResult(formats);
    result.total = articleUrls.length;
    return result;
  }

  return generateDocxForAccountInternal(fakeid, {
    source,
    articleUrls,
    formats,
    onArticleStart,
    onRetry,
    isCancelled,
  });
}

export async function generateAggregateExportsForAccount(
  fakeid: string,
  syncToTimestamp?: number,
  source: ExportSource = 'manual-sync',
  isCancelled?: () => boolean,
): Promise<AutoExportResult> {
  const formats = getAutoExportFormats().filter((format) => AGGREGATE_FORMATS.includes(format));
  if (formats.length === 0) {
    return createEmptyExportResult(formats);
  }

  return generateDocxForAccountInternal(fakeid, {
    source,
    syncToTimestamp,
    formats,
    isCancelled,
  });
}

// ==================== Excel 生成 ====================

const ITEM_SHOW_TYPE_LABEL: Record<number, string> = {
  0: '普通图文',
  8: '图片分享',
  10: '文本分享',
};

function formatTimeStamp(timestamp: number): string {
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

function formatItemShowType(type: number): string {
  return ITEM_SHOW_TYPE_LABEL[type] || '未识别';
}

async function generateExcelBuffer(data: any[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Sheet1');

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
  ];

  for (const item of data) {
    worksheet.addRow({
      _accountName: item._accountName,
      aid: item.aid,
      link: item.link,
      title: item.title,
      cover: item.pic_cdn_url_235_1 || item.pic_cdn_url_16_9 || item.cover_img || item.cover,
      digest: item.digest,
      create_time: item.create_time ? formatTimeStamp(item.create_time) : '',
      update_time: item.update_time ? formatTimeStamp(item.update_time) : '',
      readNum: item.readNum,
      oldLikeNum: item.oldLikeNum,
      shareNum: item.shareNum,
      likeNum: item.likeNum,
      commentNum: item.commentNum,
      author_name: item.author_name,
      copyright: item.copyright_stat === 1 && item.copyright_type === 1 ? '原创' : '',
      item_show_type: formatItemShowType(item.item_show_type),
      album: (item.appmsg_album_infos || []).map((a: any) => '#' + a.title).join(' '),
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/**
 * 将 cgiData 转换为指定格式的 Buffer
 */
async function convertToFormat(
  format: AutoExportFormat,
  cgiData: any,
  getCache: () => string | null,
  setCache: (html: string) => Promise<void>,
): Promise<Buffer> {
  switch (format) {
    case 'word': {
      let html = getCache();
      if (!html) {
        html = await renderHTMLFromCgiData(cgiData);
        await setCache(html);
      }
      return htmlToDocxBuffer(html);
    }
    case 'html': {
      let html = getCache();
      if (!html) {
        html = await renderHTMLFromCgiData(cgiData);
        await setCache(html);
      }
      return Buffer.from(html, 'utf-8');
    }
    case 'txt': {
      const text = renderTextFromCgiData(cgiData);
      return Buffer.from(text, 'utf-8');
    }
    case 'markdown': {
      let html = getCache();
      if (!html) {
        html = await renderHTMLFromCgiData(cgiData);
        await setCache(html);
      }
      const markdown = turndownService.turndown(html);
      return Buffer.from(markdown, 'utf-8');
    }
    default:
      throw new Error(`不支持的导出格式: ${format}`);
  }
}

async function fetchArticleHtml(url: string, context?: string): Promise<string | null> {
  try {
    await waitRandomArticleFetchDelay(`[docx-generator] ${context || '发起文章抓取'} | ${url}`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}
