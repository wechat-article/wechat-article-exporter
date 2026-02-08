import * as cheerio from 'cheerio';

const ITEM_SHOW_TYPE = {
  图片分享: 8,
  文本分享: 10,
  普通图文: 0,
};

/**
 * 根据解析的 cgiDataNew 对象进行渲染
 * @param cgiData
 */
export async function renderHTMLFromCgiDataNew(cgiData: any) {
  const title = extractTitle(cgiData);

  const meta = renderMetaInfo(cgiData);

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
        body, .__body__ {
            font-family: "PingFang SC", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Hiragino Sans GB", "Microsoft YaHei UI", "Microsoft YaHei", Arial, sans-serif;
        }
        .__page_content__ {
            max-width: 667px;
            margin: 0 auto;
            padding: 20px;
            text-size-adjust: 100%;
            color: rgba(0, 0, 0, 0.9);
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
        .sns_opr_btn::before {
            width: 16px;
            height: 16px;
            margin-right: 3px;
        }
    </style>
</head>
<body>
<div class="body __page_content__">
<h1 class="title">${title}</h1>
${meta}

<blockquote class="source">原文地址: <a href="${cgiData.link}">${cgiData.link}</a></blockquote>
${contentHTML}
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
  const $ = cheerio.load(contentHTML, { xml: true });

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

  // 2. 移除 <strong>（内容提升）
  // $('strong').each((i, elem) => {
  //   const $strong = $(elem);
  //   // 使用 .contents() 获取所有子节点（包括文本节点和元素节点），然后替换 strong 本身
  //   $strong.replaceWith($strong.contents());
  // });

  // 4. 移除 mdnice / 微信编辑器常见的冗余属性（mpa-*、leaf 等）
  $('*').each((i, elem) => {
    const $elem = $(elem);
    Object.keys($elem.attr() || {}).forEach(attr => {
      if (attr.startsWith('mpa-') || attr === 'leaf') {
        $elem.removeAttr(attr);
      }
    });
  });

  // 5. 移除完全无属性的 <span>（或只有空 style 的 <span>），内容提升
  //    这能清理大量 mdnice 产生的嵌套空 span
  // $('span').each((i, elem) => {
  //   const $span = $(elem);
  //   const attrs = Object.keys($span.attr() || {});
  //   const hasStyle = $span.attr('style') && $span.attr('style')!.trim().length > 0;
  //   const hasOtherAttr = attrs.some(a => a !== 'style');
  //
  //   if (!hasStyle && !hasOtherAttr) {
  //     $span.replaceWith($span.contents());
  //   }
  // });

  // 6. 可选：递归清理多次（因为 unwrap 后可能产生新的空 span）
  //    重复 3 次通常足够清理多层嵌套
  // for (let i = 0; i < 3; i++) {
  //   $('span').each((i, elem) => {
  //     const $span = $(elem);
  //     const attrs = Object.keys($span.attr() || {});
  //     const hasStyle = $span.attr('style') && $span.attr('style')!.trim().length > 0;
  //     const hasOtherAttr = attrs.some(a => a !== 'style');
  //
  //     if (!hasStyle && !hasOtherAttr) {
  //       $span.replaceWith($span.contents());
  //     }
  //   });
  // }

  // 7. 移除空元素（排除 br、img、hr 等有意义的空标签）
  // $(':empty').not('br,img,hr,meta,link').remove();

  // 8. 处理部分无效嵌套（Cheerio load 时已自动修复大部分块级被内联包裹的情况，
  //    如 <span><p>...</p></span> → <p>...</p><span></span>）
  //    如果仍有残留块级元素被内联包裹，可额外提升常见块级标签
  const blockTags = ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'section'];
  blockTags.forEach(tag => {
    $(tag).each((i, blockElem) => {
      const $block = $(blockElem);
      // 如果父元素是内联标签（如 span、strong、em），提升内容
      $block.parents('span,strong,em,b,i,u').each((j, parent) => {
        $(parent).replaceWith($(parent).contents());
      });
    });
  });

  // 获取处理后的 HTML 片段（cheerio 会正确序列化多顶级元素和自闭合标签）
  let modifiedContent = $.html();

  modifiedContent = modifiedContent.replace(/&amp;/g, '&');

  // 去除图片的懒加载
  return `<section class="item_show_type_0">${modifiedContent}</section>`;
}

/**
 * 渲染元数据
 * @param cgiData
 */
function renderMetaInfo(cgiData: any): string {
  return `<div class="__meta__">
    <span class="author">${cgiData.author}</span>
    <span class="nick_name">${cgiData.nick_name}</span>
    <span class="create_time">${cgiData.create_time}</span>
    <span class="ip">${cgiData.ip_wording?.province_name}</span>
</div>`;
}
