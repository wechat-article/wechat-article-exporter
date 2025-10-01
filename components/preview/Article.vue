<template>
  <div>
    <USlideover v-model="isOpen" :ui="{ width: 'max-w-[720px]' }">
      <div class="article-preview h-screen overflow-y-scroll">
        <HtmlRenderer :html="articleHtml" />
      </div>
    </USlideover>
  </div>
</template>

<script setup lang="ts">
import type { AppMsgEx } from '~/types/types';
import HtmlRenderer from '~/components/preview/HtmlRenderer.vue';
import { getHtmlCache, type HtmlAsset } from '~/store/v2/html';
import type { Preferences } from '~/types/preferences';
import usePreferences from '~/composables/usePreferences';
import { getMetadataCache } from '~/store/v2/metadata';
import { renderComments } from '~/utils/comment';

const isOpen = ref(false);
const articleHtml = ref('');

async function open(article: AppMsgEx) {
  const htmlAsset = await getHtmlCache(article.link);
  if (htmlAsset) {
    isOpen.value = true;
    const rawHtml = await htmlAsset.file.text();
    articleHtml.value = await normalizeHtml(htmlAsset, rawHtml);
  } else {
    console.warn('文章未缓存');
  }
}

defineExpose({
  open: open,
});

const preferences: Ref<Preferences> = usePreferences() as unknown as Ref<Preferences>;

// 调整最终的 html
async function normalizeHtml(cachedHtml: HtmlAsset, html: string): Promise<string> {
  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const $jsArticleContent = document.querySelector('#js_article')!;

  // #js_content 默认是不可见的(通过js修改为可见)，需要移除该样式
  $jsArticleContent.querySelector('#js_content')?.removeAttribute('style');

  // 删除无用dom元素
  $jsArticleContent.querySelector('#js_top_ad_area')?.remove();
  $jsArticleContent.querySelector('#js_tags_preview_toast')?.remove();
  $jsArticleContent.querySelector('#content_bottom_area')?.remove();
  $jsArticleContent.querySelectorAll('script').forEach(el => {
    el.remove();
  });
  $jsArticleContent.querySelector('#js_pc_qr_code')?.remove();
  $jsArticleContent.querySelector('#wx_stream_article_slide_tip')?.remove();

  let bodyCls = document.body.className;

  // 渲染发布时间
  function __setPubTime(oriTimestamp: number, dom: HTMLElement) {
    const dateObj = new Date(oriTimestamp * 1000);
    const padStart = function padStart(v: number) {
      return '0'.concat(v.toString()).slice(-2);
    };
    const year = dateObj.getFullYear().toString();
    const month = padStart(dateObj.getMonth() + 1);
    const date = padStart(dateObj.getDate());
    const hour = padStart(dateObj.getHours());
    const minute = padStart(dateObj.getMinutes());
    const timeString = ''.concat(hour, ':').concat(minute);
    const dateString = ''.concat(year, '年').concat(month, '月').concat(date, '日');
    const showDate = ''.concat(dateString, ' ').concat(timeString);

    if (dom) {
      dom.innerText = showDate;
    }
  }
  const pubTimeMatchResult = html.match(/var oriCreateTime = '(?<date>\d+)'/);
  if (pubTimeMatchResult && pubTimeMatchResult.groups && pubTimeMatchResult.groups.date) {
    __setPubTime(parseInt(pubTimeMatchResult.groups.date), document.getElementById('publish_time')!);
  }

  // 渲染ip属地
  function getIpWoridng(ipConfig: any) {
    let ipWording = '';
    if (parseInt(ipConfig.countryId, 10) === 156) {
      ipWording = ipConfig.provinceName;
    } else if (ipConfig.countryId) {
      ipWording = ipConfig.countryName;
    }
    return ipWording;
  }
  const ipWrp = document.getElementById('js_ip_wording_wrp')!;
  const ipWording = document.getElementById('js_ip_wording')!;
  const ipWordingMatchResult = html.match(/window\.ip_wording = (?<data>{\s+countryName: '[^']+',[^}]+})/s);
  if (ipWrp && ipWording && ipWordingMatchResult && ipWordingMatchResult.groups && ipWordingMatchResult.groups.data) {
    const json = ipWordingMatchResult.groups.data;
    eval('window.ip_wording = ' + json);
    const ipWordingDisplay = getIpWoridng((window as any).ip_wording);
    if (ipWordingDisplay !== '') {
      ipWording.innerHTML = ipWordingDisplay;
      ipWrp.style.display = 'inline-block';
    }
  }

  // 渲染 标题已修改
  function __setTitleModify(isTitleModified: boolean) {
    const wrp = document.getElementById('js_title_modify_wrp')!;
    const titleModifyNode = document.getElementById('js_title_modify')!;
    if (!wrp) return;
    if (isTitleModified) {
      titleModifyNode.innerHTML = '标题已修改';
      wrp.style.display = 'inline-block';
    } else {
      wrp.parentNode?.removeChild(wrp);
    }
  }
  const titleModifiedMatchResult = html.match(/window\.isTitleModified = "(?<data>\d*)" \* 1;/);
  if (titleModifiedMatchResult && titleModifiedMatchResult.groups && titleModifiedMatchResult.groups.data) {
    __setTitleModify(titleModifiedMatchResult.groups.data === '1');
  }

  // 文章引用
  const js_share_source = document.getElementById('js_share_source');
  const contentTpl = document.getElementById('content_tpl');
  if (js_share_source && contentTpl) {
    const html = contentTpl.innerHTML
      .replace(/<img[^>]*>/g, '<p>[图片]</p>')
      .replace(
        /<iframe [^>]*?class=\"res_iframe card_iframe js_editor_card\"[^>]*?data-cardid=[\'\"][^\'\"]*[^>]*?><\/iframe>/gi,
        '<p>[卡券]</p>'
      )
      .replace(/<mpvoice([^>]*?)js_editor_audio([^>]*?)><\/mpvoice>/g, '<p>[语音]</p>')
      .replace(/<mpgongyi([^>]*?)js_editor_gy([^>]*?)><\/mpgongyi>/g, '<p>[公益]</p>')
      .replace(/<qqmusic([^>]*?)js_editor_qqmusic([^>]*?)><\/qqmusic>/g, '<p>[音乐]</p>')
      .replace(/<mpshop([^>]*?)js_editor_shop([^>]*?)><\/mpshop>/g, '<p>[小店]</p>')
      .replace(/<iframe([^>]*?)class=[\'\"][^\'\"]*video_iframe([^>]*?)><\/iframe>/g, '<p>[视频]</p>')
      .replace(/(<iframe[^>]*?js_editor_vote_card[^<]*?<\/iframe>)/gi, '<p>[投票]</p>')
      .replace(/<mp-weapp([^>]*?)weapp_element([^>]*?)><\/mp-weapp>/g, '<p>[小程序]</p>')
      .replace(/<mp-miniprogram([^>]*?)><\/mp-miniprogram>/g, '<p>[小程序]</p>')
      .replace(/<mpproduct([^>]*?)><\/mpproduct>/g, '<p>[商品]</p>')
      .replace(/<mpcps([^>]*?)><\/mpcps>/g, '<p>[商品]</p>');
    const div = document.createElement('div');
    div.innerHTML = html;
    let content = div.innerText;
    content = content.replace(/</g, '&lt;').replace(/>/g, '&gt;').trim();
    if (content.length > 140) {
      content = content.substr(0, 140) + '...';
    }
    const digest = content.split('\n').map(function (line) {
      return '<p>' + line + '</p>';
    });
    document.getElementById('js_content')!.innerHTML = digest.join('');

    // 替换url
    const sourceURL = js_share_source.getAttribute('data-url');
    if (sourceURL) {
      const link = document.createElement('a');
      link.href = sourceURL;
      link.className = js_share_source.className;
      link.innerHTML = js_share_source.innerHTML;
      js_share_source.replaceWith(link);
    }
  }

  // 渲染阅读量
  const metadata = await getMetadataCache(cachedHtml.url);
  const $interaction_bar = document.querySelector('#js_article_bottom_bar .interaction_bar');
  if ($interaction_bar) {
    $interaction_bar.insertAdjacentHTML(
      'afterbegin',
      '<button id="js_temp_sns_sc_readnum_btn" aria-labelledby="js_a11y_zan_btn_txt readNum" style="-webkit-text-size-adjust:  100% ;" class="sns_opr_btn sns_view_btn weui-wa-hotarea js_wx_tap_highlight wx_tap_link">' +
        `<span class="sns_opr_gap" aria-hidden="true" id="js_bar_readnum_btn">${metadata?.readNum}</span></button>`
    );
  }

  // 渲染留言
  let commentHTML = '';
  if ((preferences.value as Preferences).exportConfig.exportHtmlIncludeComments) {
    commentHTML = await renderComments(cachedHtml.url);
  }

  // 图片分享消息
  const $js_image_desc = $jsArticleContent.querySelector('#js_image_desc');
  if ($js_image_desc) {
    bodyCls += 'pages_skin_pc page_share_img';

    function decode_html(data: string, encode: boolean) {
      const replace = [
        '&#39;',
        "'",
        '&quot;',
        '"',
        '&nbsp;',
        ' ',
        '&gt;',
        '>',
        '&lt;',
        '<',
        '&yen;',
        '¥',
        '&amp;',
        '&',
      ];
      const replaceReverse = [
        '&',
        '&amp;',
        '¥',
        '&yen;',
        '<',
        '&lt;',
        '>',
        '&gt;',
        ' ',
        '&nbsp;',
        '"',
        '&quot;',
        "'",
        '&#39;',
      ];

      let target = encode ? replaceReverse : replace;
      let str = data;
      for (let i = 0; i < target.length; i += 2) {
        str = str.replace(new RegExp(target[i], 'g'), target[i + 1]);
      }
      return str;
    }

    const qmtplMatchResult = html.match(/(?<code>window\.__QMTPL_SSR_DATA__\s*=\s*\{.+?)<\/script>/s);
    if (qmtplMatchResult && qmtplMatchResult.groups && qmtplMatchResult.groups.code) {
      const code = qmtplMatchResult.groups.code;
      eval(code);
      const data = (window as any).__QMTPL_SSR_DATA__;
      let desc = data.desc.replace(/\r/g, '').replace(/\n/g, '<br>').replace(/\s/g, '&nbsp;');
      desc = decode_html(desc, false);
      $js_image_desc.innerHTML = desc;

      $jsArticleContent.querySelector('#js_top_profile')!.classList.remove('profile_area_hide');
    }
    const pictureMatchResult = html.match(/(?<code>window\.picture_page_info_list\s*=.+\.slice\(0,\s*20\);)/s);
    if (pictureMatchResult && pictureMatchResult.groups && pictureMatchResult.groups.code) {
      const code = pictureMatchResult.groups.code;
      eval(code);
      const picture_page_info_list = (window as any).picture_page_info_list;
      const containerEl = $jsArticleContent.querySelector('#js_share_content_page_hd')!;
      let innerHTML =
        '<div style="display: flex;flex-direction: column;align-items: center;gap: 10px;padding-block: 20px;">';
      for (const picture of picture_page_info_list) {
        innerHTML += `<img src="${picture.cdn_url}" alt="" style="display: block;border: 1px solid gray;border-radius: 5px;max-width: 90%;" onclick="window.open(this.src, '_blank', 'popup')" />`;
      }
      innerHTML += '</div>';
      containerEl.innerHTML = innerHTML;
    }
  }

  // 去除图片的懒加载
  const imgs = document.querySelectorAll<HTMLImageElement>('img');
  for (const img of imgs) {
    const imgUrl = img.getAttribute('src') || img.getAttribute('data-src');
    if (imgUrl) {
      img.src = imgUrl;
    }
  }

  // 所有图片都替换完成后，重新解析得到最终的主内容和bottom内容
  const newDocument = parser.parseFromString(document.documentElement.outerHTML, 'text/html');
  const pageContentHTML = newDocument.querySelector('#js_article')!.outerHTML;
  const jsArticleBottomBarHTML = newDocument.querySelector('#js_article_bottom_bar')?.outerHTML;

  return `<!DOCTYPE html>
<html lang="zh_CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
    <meta name="referrer" content="no-referrer">
    <title>${cachedHtml.title}</title>
    <style>
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
${jsArticleBottomBarHTML}

<!-- 评论数据 -->
${commentHTML}
</body>
</html>`;
}
</script>
