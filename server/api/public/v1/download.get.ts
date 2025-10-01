// import { JSDOM } from 'jsdom';
import TurndownService from 'turndown';
import { getTokenFromStore } from '~/server/utils/CookieStore';

interface SearchBizQuery {
  url: string;
  format: string;
}

export default defineEventHandler(async event => {
  const token = getTokenFromStore(event);

  if (!token) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '认证信息无效',
      },
    };
  }

  const query = getQuery<SearchBizQuery>(event);
  if (!query.url) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'url不能为空',
      },
    };
  }

  const url = decodeURIComponent(query.url);
  const format: string = query.format || 'html';
  if (!['html', 'markdown', 'text'].includes(format)) {
    return {
      base_resp: {
        ret: -1,
        err_msg: '不支持的format',
      },
    };
  }

  const html = await fetch(`https://08.workers-proxy.shop/?url=${url}`, {
    headers: {
      Referer: 'http://localhost:3000',
      Origin: 'http://localhost:3000',
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36',
    },
  }).then(res => res.text());

  // const document = new JSDOM(html).window.document;

  // const jsArticleEl = document.querySelector('#js_article')!;

  // #js_content 默认是不可见的(通过js修改为可见)，需要移除该样式
  // jsArticleEl.querySelector('#js_content')?.removeAttribute('style');

  // 删除无用dom元素
  // jsArticleEl.querySelector('#js_top_ad_area')?.remove();
  // jsArticleEl.querySelector('#js_tags_preview_toast')?.remove();
  // jsArticleEl.querySelector('#content_bottom_area')?.remove();
  // jsArticleEl.querySelectorAll('script').forEach(el => {
  //   el.remove();
  // });
  // jsArticleEl.querySelector('#js_pc_qr_code')?.remove();
  // jsArticleEl.querySelector('#wx_stream_article_slide_tip')?.remove();

  // 处理图片懒加载
  // const imgs = document.querySelectorAll<HTMLImageElement>('img');
  // for (const img of imgs) {
  //   const imgUrl = img.getAttribute('src') || img.getAttribute('data-src');
  //   if (imgUrl) {
  //     img.src = imgUrl;
  //   }
  // }

  // let bodyCls = document.body.className;
  // const pageContentHTML = jsArticleEl.outerHTML;

  if (format === 'html') {
    //     return `<!DOCTYPE html>
    // <html lang="zh_CN">
    // <head>
    //     <meta charset="utf-8">
    //     <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    //     <meta http-equiv="X-UA-Compatible" content="IE=edge">
    //     <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
    //     <meta name="referrer" content="no-referrer">
    //     <style>
    //         #js_row_immersive_stream_wrap {
    //             max-width: 667px;
    //             margin: 0 auto;
    //         }
    //         #js_row_immersive_stream_wrap .wx_follow_avatar_pic {
    //           display: block;
    //           margin: 0 auto;
    //         }
    //         #page-content,
    //         #js_article_bottom_bar,
    //         .__page_content__ {
    //             max-width: 667px;
    //             margin: 0 auto;
    //         }
    //         img {
    //             max-width: 100%;
    //         }
    //         .sns_opr_btn::before {
    //             width: 16px;
    //             height: 16px;
    //             margin-right: 3px;
    //         }
    //     </style>
    // </head>
    // <body class="${bodyCls}">
    // ${pageContentHTML}
    // </body>
    // </html>
    //   `;
  } else if (format === 'markdown') {
    // const turndownService = new TurndownService();
    // return turndownService.turndown(pageContentHTML);
  } else {
    return '';
  }
});
