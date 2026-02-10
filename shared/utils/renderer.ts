import * as cheerio from 'cheerio';
import { getMetadataCache } from '~/store/v2/metadata';
import type { ArticleMetadata } from '~/utils/download/types';
import { renderComments } from '~/utils/comment';

const ITEM_SHOW_TYPE = {
  图片分享: 8,
  文本分享: 10,
  普通图文: 0,
};

/**
 * 根据解析的 cgiDataNew 对象进行渲染
 * @param cgiData
 * @param comments 是否渲染留言数据，默认是
 */
export async function renderHTMLFromCgiDataNew(cgiData: any, comments = true) {
  const title = extractTitle(cgiData);
  const meta = renderMetaInfo(cgiData);
  const contentHTML = extractContentHTML(cgiData);
  const bottomBarHTML = await renderBottomBar(cgiData);

  // 渲染留言
  let commentHTML = '';
  if (comments) {
    commentHTML = await renderComments(cgiData.link);
  }

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
${commentHTML}

${bottomBarHTML}
</div>
</body>
</html>`;
}

/**
 * 提取标题字段(title)
 * @param cgiData
 */
function extractTitle(cgiData: any): string {
  let title = '';
  switch (cgiData.item_show_type) {
    case ITEM_SHOW_TYPE.图片分享:
    case ITEM_SHOW_TYPE.普通图文:
      title = cgiData.title;
      break;
    case ITEM_SHOW_TYPE.文本分享:
      if (cgiData.text_page_info.is_user_title === 1) {
        title = cgiData.title;
      } else {
        title = '(无标题)';
      }
      break;
    default:
      title = '(unknown)';
      break;
  }
  return title;
}

/**
 * 提取内容html
 * @param cgiData
 */
function extractContentHTML(cgiData: any): string {
  let contentHTML = '';
  switch (cgiData.item_show_type) {
    case ITEM_SHOW_TYPE.图片分享:
      contentHTML = renderContent_8(cgiData);
      break;
    case ITEM_SHOW_TYPE.文本分享:
      contentHTML = renderContent_10(cgiData);
      break;
    case ITEM_SHOW_TYPE.普通图文:
      contentHTML = renderContent_0(cgiData);
      break;
    default:
      contentHTML = '(unknown)';
      break;
  }
  return contentHTML;
}

/**
 * 渲染【图片分享(8)】类文章的内容部分
 * @param cgiData
 */
function renderContent_8(cgiData: any): string {
  // 文本内容
  let textContent = cgiData.content_noencode.replace(/\n/g, '<br />');
  // 替换函数：在<a> 标签上插入 href 属性，href="#图X"
  const regex = /(<a class="wx_img_refer_link" data-seq="(\d+)" data-refer="图\2" style="[^"]*">)(\s*图\2\s*)(<\/a>)/g;
  textContent = textContent.replace(regex, (match: any, openTag: any, number: any, content: any, closeTag: any) => {
    const newOpenTag = openTag.replace(/>$/, ` href="#图${number}">`);
    return newOpenTag + content + closeTag;
  });

  // 图片内容
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

/**
 * 渲染【文本分享(10)】类文章的内容部分
 * @param cgiData
 */
function renderContent_10(cgiData: any): string {
  // 文本内容
  const textContent = cgiData.text_page_info.content_noencode.replace(/\n/g, '<br />');

  return `<section class="item_show_type_10">
<p class="text_content">${textContent}</p>
</section>`;
}

/**
 * 渲染【普通图文(0)】类文章的内容部分
 * @param cgiData
 */
function renderContent_0(cgiData: any): string {
  let contentHTML = cgiData.content_noencode || '';

  // 使用 cheerio 处理 HTML 片段
  const $ = cheerio.load(contentHTML, null, false);

  // 1. 处理懒加载图片：data-src → src
  $('img[data-src]').each((i, elem) => {
    const $img = $(elem);
    const dataSrc = $img.attr('data-src');

    if (dataSrc) {
      $img.attr('src', dataSrc);
      $img.removeAttr('data-src');
      $img.attr('loading', 'eager');
    }
  });

  // 2. 修复图片的宽高比例 (删除`height`属性即可)
  $('img[height]').each((i, elem) => {
    const $img = $(elem);
    $img.removeAttr('height');
  });

  // 3. 处理内嵌视频

  // 获取处理后的 HTML 片段（cheerio 会正确序列化多顶级元素和自闭合标签）
  let modifiedContent = $.html();
  return `<section class="item_show_type_0">${modifiedContent}</section>`;
}

/**
 * 渲染元数据
 * @param cgiData
 */
function renderMetaInfo(cgiData: any): string {
  return `<div class="__meta__">
    <span class="copyright">原创</span>
    <span class="author">${cgiData.author}</span>
    <span class="nick_name">${cgiData.nick_name}</span>
    <span class="create_time">${cgiData.create_time}</span>
    <span class="ip">${cgiData.ip_wording?.province_name}</span>
</div>`;
}

/**
 * 渲染底部 BottomBar
 * @param cgiData
 */
async function renderBottomBar(cgiData: any) {
  const metadata: ArticleMetadata = (await getMetadataCache(cgiData.link)) || {
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
