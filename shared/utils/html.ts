import * as cheerio from 'cheerio';
import { EXTERNAL_API_SERVICE } from '~/config';
import { extractCommentId } from '~/utils/comment';

/**
 * 处理文章的 html 内容
 * @description 采用 cheerio 库解析并修改 html 内容
 * @param rawHTML 公众号文章的原始 html
 * @param format 要处理的格式(默认html)
 * @remarks 服务端工具函数
 */
export function normalizeHtml(rawHTML: string, format: 'html' | 'text' = 'html'): string {
  const $ = cheerio.load(rawHTML);
  const $jsArticleContent = $('#js_article');

  // #js_content 默认是不可见的(通过js修改为可见)，需要移除该样式
  $jsArticleContent.find('#js_content').removeAttr('style');

  // 删除无用dom元素
  $jsArticleContent.find('#js_top_ad_area').remove();
  $jsArticleContent.find('#js_tags_preview_toast').remove();
  $jsArticleContent.find('#content_bottom_area').remove();

  // 删除所有 script 标签（在 #js_article 上下文中）
  $jsArticleContent.find('script').remove();

  $jsArticleContent.find('#js_pc_qr_code').remove();
  $jsArticleContent.find('#wx_stream_article_slide_tip').remove();

  // 处理图片懒加载（全局处理所有 img）
  $('img').each((i, el) => {
    const $img = $(el);
    const imgUrl = $img.attr('src') || $img.attr('data-src');
    if (imgUrl) {
      $img.attr('src', imgUrl);
    }
  });

  if (format === 'text') {
    // 获取纯文本内容
    const text = $jsArticleContent.text().trim().replace(/\n+/g, '\n').replace(/ +/g, ' ');
    // 分割成行
    const lines = text.split('\n');
    // 过滤掉全空白行（^\s*$ 表示行首到行尾全是空白字符）
    const filteredLines = lines.filter(line => !/^\s*$/.test(line));

    // 重新连接行
    return filteredLines.join('\n');
  } else if (format === 'html') {
    // 获取修改后的 HTML
    let bodyCls = $('body').attr('class');
    const pageContentHTML = $('<div>').append($jsArticleContent.clone()).html();
    return `<!DOCTYPE html>
  <html lang="zh_CN">
  <head>
      <meta charset="utf-8">
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
      <meta name="referrer" content="no-referrer">
      <style>
          #js_row_immersive_stream_wrap {
              max-width: 667px;
              margin: 0 auto;
          }
          #js_row_immersive_stream_wrap .wx_follow_avatar_pic {
            display: block;
            margin: 0 auto;
          }
          #page-content,
          #js_article_bottom_bar,
          .__page_content__ {
              max-width: 667px;
              margin: 0 auto;
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
  <body class="${bodyCls}">
  ${pageContentHTML}
  </body>
  </html>
    `;
  } else {
    throw new Error(`format not supported: ${format}`);
  }
}

/**
 * 验证文章的 html 内容是否下载成功，以及提取出 commentID
 * @param html
 * @return [状态，commentID/msg] 二元组
 */
export function validateHTMLContent(html: string): ['Success' | 'Deleted' | 'Exception' | 'Error', string | null] {
  const $ = cheerio.load(html);
  const $jsArticle = $('#js_article');
  const $weuiMsg = $('.weui-msg');
  const $msgBlock = $('.mesg-block');

  if ($jsArticle.length === 1) {
    // 成功
    const commentID = extractCommentId(html);
    return ['Success', commentID];
  } else if ($weuiMsg.length === 1) {
    // 失败，需要进一步判断失败类型
    const msg = $('.weui-msg .weui-msg__title').text().trim().replace(/\n+/g, '').replace(/ +/g, ' ');
    if (msg && ['The content has been deleted by the author.', '该内容已被发布者删除'].includes(msg)) {
      return ['Deleted', null];
    } else {
      return ['Exception', msg];
    }
  } else if ($msgBlock.length === 1) {
    const msg = $msgBlock.text().trim().replace(/\n+/g, '').replace(/ +/g, ' ');
    return ['Exception', msg];
  } else {
    return ['Error', null];
  }
}

/**
 * 提取 window.cgiDataNew 所在脚本的代码
 * @param html 文章的完整 html 内容
 * @return 脚本代码 (纯代码，不含 <script> 标签)
 * @remarks 内部使用 cheerio 库进行解析，可运行在浏览器端和服务器端。
 */
function extractCgiScript(html: string) {
  const $ = cheerio.load(html);

  const scriptEl = $('script[type="text/javascript"][h5only]').filter((i, el) => {
    const content = $(el).html() || '';
    return content.includes('window.cgiDataNew = ');
  });

  if (scriptEl.length !== 1) {
    console.warn('未找到包含 cgiDataNew 的目标 script');
    return null;
  }

  return scriptEl.html()?.trim() || null;
}

/**
 * 从 html 中提取 cgiDataNew 对象
 * @param html 文章的完整 html 内容
 * @return window.cgiDataNew 对象，解析失败时返回 null
 */
function parseCgiDataNewOnClient(html: string): Promise<any> {
  const code = extractCgiScript(html);
  if (!code) {
    return Promise.resolve(null);
  }

  const iframe = document.createElement('iframe');
  iframe.style.display = 'none';
  iframe.srcdoc = `<script type="text/javascript">${code}</script>`;
  document.body.appendChild(iframe);

  return new Promise((resolve, reject) => {
    iframe.onload = function () {
      // @ts-ignore
      const data = iframe.contentWindow.cgiDataNew;

      // 用完后清理
      document.body.removeChild(iframe);
      resolve(data);
    };
    iframe.onerror = function (e) {
      reject(e);
    };
  });
}

/**
 * 从 html 中提取 cgiDataNew 对象
 * @deprecated Cloudflare 平台禁止任何动态执行脚本，故本方法在 CF 平台无效
 * @param html 文章的完整 html 内容
 * @return window.cgiDataNew 对象，解析失败时返回 null
 */
function parseCgiDataNewOnServerDeprecated(html: string): Promise<any> {
  const code = extractCgiScript(html);
  if (!code) {
    return Promise.resolve(null);
  }

  // 1. 创建沙箱
  const sandbox: any = {
    window: {},
    console: { log: () => {}, error: () => {} }, // 可选：屏蔽 console
    // 如果脚本依赖其他全局，可在这里 mock（如 Date, Math 等已存在）
  };
  sandbox.window = sandbox; // 关键：让 window.xxx 落入沙箱

  // 2. 执行代码（new Function 比 eval 稍安全）
  const func = new Function('window', code);
  func(sandbox.window);

  return sandbox.cgiDataNew || sandbox.window?.cgiDataNew;
}

/**
 * 从 html 中提取 cgiDataNew 对象
 * @param html 文章的完整 html 内容
 * @return window.cgiDataNew 对象，解析失败时返回 null
 */
async function parseCgiDataNewOnServer(html: string): Promise<any> {
  const code = extractCgiScript(html);
  if (!code) {
    return Promise.resolve(null);
  }

  try {
    const data = await fetch(`${EXTERNAL_API_SERVICE}/api/tools/eval-js-code`, {
      method: 'POST',
      body: code,
    }).then(res => res.json());
    if (data && data.executionError === null) {
      return data.window.cgiDataNew;
    }
    return null;
  } catch (error) {
    console.error(error);
  }
  return null;
}

/**
 * 从 html 中提取 cgiDataNew 对象
 * @param html 文章的完整 html 内容
 * @return window.cgiDataNew 对象，解析失败时返回 null
 */
export async function parseCgiDataNew(html: string): Promise<any> {
  if (process.client && typeof document === 'object') {
    return parseCgiDataNewOnClient(html);
  } else {
    return parseCgiDataNewOnServer(html);
  }
}
