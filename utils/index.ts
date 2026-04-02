import JSZip from 'jszip';
import mime from 'mime';
import { formatTimeStamp, sleep } from '#shared/utils/helpers';
import { request } from '#shared/utils/request';
import { getComment } from '~/apis';
import { getAssetCache, updateAssetCache } from '~/store/v2/assets';
import type { DownloadableArticle } from '~/types/types';
import type { AudioResource, VideoPageInfo } from '~/types/video';
import * as pool from '~/utils/pool';
import { extractCommentId } from './comment';

/**
 * 使用代理下载资源
 * @param url 资源地址
 * @param proxy 代理地址
 * @param withCredential
 * @param timeout 超时时间(单位: 秒)，默认 30
 */
async function downloadAssetWithProxy<T extends Blob | string>(
  url: string,
  proxy: string | undefined,
  withCredential = false,
  timeout = 30
) {
  const headers: Record<string, string> = {};
  if (withCredential) {
    try {
      const credentials = JSON.parse(window.localStorage.getItem('credentials')!);
      headers.cookie = `pass_ticket=${credentials.pass_ticket};wap_sid2=${credentials.wap_sid2}`;
    } catch (e) {}
  }
  let targetURL = proxy
    ? `${proxy}?url=${encodeURIComponent(url)}&headers=${encodeURIComponent(JSON.stringify(headers))}`
    : url;
  targetURL = targetURL.replace(/^http:\/\//, 'https://');

  return await request<T>(targetURL, {
    timeout: timeout * 1000,
    referrerPolicy: 'unsafe-url',
  });
}

/**
 * 下载文章的 html
 * @param articleURL
 * @param title
 */
async function downloadArticleHTML(articleURL: string, title?: string) {
  let html = '';
  const parser = new DOMParser();

  const htmlDownloadFn = async (url: string, proxy: string) => {
    const fullHTML = await downloadAssetWithProxy<string>(url, proxy, true);

    // 验证是否下载完整
    const document = parser.parseFromString(fullHTML, 'text/html');
    const $jsContent = document.querySelector('#js_content');
    const $layout = document.querySelector('#js_fullscreen_layout_padding');
    if (!$jsContent) {
      if ($layout) {
        console.warn(`文章(${title})已被删除，跳过下载`);
        return 0;
      }

      console.warn(`文章(${title})下载失败`);
      throw new Error('下载失败，请重试');
    }
    html = fullHTML;

    return new Blob([html]).size;
  };

  await pool.downloads([articleURL], htmlDownloadFn);

  if (!html) {
    throw new Error('下载html失败，请稍后重试');
  }

  return html;
}

/**
 * 批量下载文章 html
 * @param articles
 * @param callback
 */
export async function downloadArticleHTMLs(articles: DownloadableArticle[], callback: (count: number) => void) {
  const parser = new DOMParser();
  const results: DownloadableArticle[] = [];

  const htmlDownloadFn = async (article: DownloadableArticle, proxy: string) => {
    const fullHTML = await downloadAssetWithProxy<string>(article.url, proxy, true);

    // 验证是否下载完整
    const document = parser.parseFromString(fullHTML, 'text/html');
    const $jsContent = document.querySelector('#js_content');
    const $layout = document.querySelector('#js_fullscreen_layout_padding');
    if (!$jsContent) {
      if ($layout) {
        console.warn(`文章(${article.title})已被删除，跳过下载`);
        return 0;
      }

      console.warn(`文章(${article.title})下载失败`);
      throw new Error('下载失败，请重试');
    }

    article.html = fullHTML;
    results.push(article);
    callback(results.length);
    await sleep(2000);

    return new Blob([fullHTML]).size;
  };

  await pool.downloads(articles, htmlDownloadFn);

  return results;
}

/**
 * 打包 html 中的资源
 * @param fakeid
 * @param html
 * @param title
 * @param zip
 */
export async function packHTMLAssets(fakeid: string, html: string, title: string, zip?: JSZip) {
  if (!zip) {
    zip = new JSZip();
  }
  zip.folder('assets');

  const parser = new DOMParser();
  const document = parser.parseFromString(html, 'text/html');
  const $jsArticleContent = document.querySelector('#js_article')!;
  const $jsArticleBottomBar = document.querySelector('#js_article_bottom_bar')!;

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
    // eslint-disable-next-line no-eval
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

  // 文本分享消息
  const $js_text_desc = $jsArticleContent.querySelector('#js_text_desc') as HTMLElement | null;
  if ($js_text_desc) {
    // 文本分享样式
    bodyCls += ' page_share_text';

    // 顶部作者栏
    const qmtplTextMatchResult = html.match(/(?<code>window\.__QMTPL_SSR_DATA__\s*=\s*\{.+?};)/s);
    if (qmtplTextMatchResult && qmtplTextMatchResult.groups && qmtplTextMatchResult.groups.code) {
      const code = qmtplTextMatchResult.groups.code;
      // eslint-disable-next-line no-eval
      eval(code);
      const data = (window as any).__QMTPL_SSR_DATA__;
      if (data && typeof data.title === 'string' && !$js_text_desc.innerHTML.trim()) {
        let text = data.title as string;
        text = text.replace(/\r/g, '').replace(/\n/g, '<br>');
        $js_text_desc.innerHTML = text;
      }
      $jsArticleContent.querySelector('#js_top_profile')?.classList.remove('profile_area_hide');
    }

    // 正文内容
    if (!$js_text_desc.innerHTML.trim()) {
      const textContentMatch = html.match(
        /var\s+TextContentNoEncode\s*=\s*window\.a_value_which_never_exists\s*\|\|\s*(?<value>'[^']*')/s
      );
      const contentMatch = html.match(
        /var\s+ContentNoEncode\s*=\s*window\.a_value_which_never_exists\s*\|\|\s*(?<value>'[^']*')/s
      );

      let desc: string | null = null;
      const assignFromMatch = (match: RegExpMatchArray | null, key: string) => {
        if (match && match.groups && match.groups.value) {
          const code = `window.${key} = ${match.groups.value}`;
          // eslint-disable-next-line no-eval
          eval(code);
          // @ts-ignore
          return (window as any)[key] as string;
        }
        return null;
      };

      desc = assignFromMatch(textContentMatch, '__WX_TEXT_NO_ENCODE__');
      if (!desc) {
        desc = assignFromMatch(contentMatch, '__WX_CONTENT_NO_ENCODE__');
      }

      if (desc) {
        desc = desc.replace(/\r/g, '').replace(/\n/g, '<br>');
        $js_text_desc.innerHTML = desc;
      }
    }
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

  // 下载留言数据
  let commentHTML = '';
  const comment_id = extractCommentId(html);
  if (comment_id) {
    const commentResponse = await getComment(comment_id);
    // 抓到了留言数据
    if (commentResponse) {
      // 留言总数
      const totalCount =
        commentResponse.elected_comment.length +
        commentResponse.elected_comment.reduce((total, item) => {
          return total + item.reply_new.reply_total_cnt;
        }, 0);

      commentHTML += '<div style="max-width: 667px;margin: 0 auto;padding: 10px 10px 80px;">';
      commentHTML += `<p style="font-size: 15px;color: #949494;">留言 ${totalCount}</p>`;
      commentHTML += '<div style="margin-top: -10px;">';
      commentResponse.elected_comment.forEach(comment => {
        commentHTML += '<div style="margin-top: 25px;"><div style="display: flex;">';
        if ([1, 2].includes(comment.identity_type)) {
          commentHTML += `<img src="${comment.logo_url}" style="display: block;width: 30px;height: 30px;border-radius: 50%;margin-right: 8px;" alt="">`;
        } else {
          commentHTML += `<img src="${comment.logo_url}" style="display: block;width: 30px;height: 30px;border-radius: 2px;margin-right: 8px;" alt="">`;
        }
        commentHTML += '<div style="flex: 1;"><p style="display: flex;line-height: 16px;margin-bottom: 5px;">';
        commentHTML += `<span style="margin-right: 5px;font-size: 15px;color: #949494;">${comment.nick_name}</span>`;
        commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #b5b5b5;">${comment?.ip_wording?.province_name}</span>`;
        commentHTML += `<span style="font-size: 12px;color: #b5b5b5;">${formatTimeStamp(comment.create_time)}</span>`;
        commentHTML += '<span style="flex: 1;"></span><span style="display: inline-flex;align-items: center;">';
        commentHTML += `<span class="sns_opr_btn sns_praise_btn" style="font-size: 12px;color: #8b8a8a;">${comment.like_num || ''}</span>`;
        commentHTML += '</span></p>';
        commentHTML += `<p style="font-size: 15px;color: #333;white-space: pre-line;">${comment.content}</p>`;
        commentHTML += '</div></div>';

        if (comment.reply_new && comment.reply_new.reply_list.length > 0) {
          commentHTML += '<div style="padding-left: 38px;">';
          comment.reply_new.reply_list.forEach(reply => {
            commentHTML += '<div style="display: flex;margin-top: 15px;">';
            if ([1, 2].includes(reply.identity_type)) {
              commentHTML += `<img src="${reply.logo_url}" style="display: block;width: 23px;height: 23px;border-radius: 50%;margin-right: 8px;" alt="">`;
            } else {
              commentHTML += `<img src="${reply.logo_url}" style="display: block;width: 23px;height: 23px;border-radius: 2px;margin-right: 8px;" alt="">`;
            }
            commentHTML += '<div style="flex: 1;"><p style="display: flex;line-height: 16px;margin-bottom: 5px;">';
            commentHTML += `<span style="margin-right: 5px;font-size: 15px;color: #949494;">${reply.nick_name}</span>`;
            commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #b5b5b5;">${reply?.ip_wording?.province_name}</span>`;
            commentHTML += `<span style="font-size: 12px;color: #b5b5b5;">${formatTimeStamp(reply.create_time)}</span>`;
            commentHTML +=
              '<span style="flex: 1;"></span><span style="display: inline-flex;align-items: center; font-size: 12px;color: #b5b5b5;">';
            commentHTML += `<span class="sns_opr_btn sns_praise_btn" style="font-size: 12px;color: #8b8a8a;">${reply.reply_like_num || ''}</span>`;
            commentHTML += '</span></p>';
            commentHTML += `<p style="font-size: 15px;color: #333;white-space: pre-line;">${reply.content}</p>`;
            commentHTML += '</div></div>';
          });
          commentHTML += '</div>';
        }
        if (comment.reply_new.reply_total_cnt - comment.reply_new.reply_list.length > 0) {
          commentHTML +=
            '<p style="display: flex;align-items: center; font-size: 14px;color: #a3a0a0;padding-left: 38px;padding-top: 5px;">';
          commentHTML += `<span>${comment.reply_new.reply_total_cnt - comment.reply_new.reply_list.length}条回复</span>`;
          commentHTML +=
            '<img src="https://wxa.wxs.qq.com/images/wxapp/feedback_icon.png" alt="" style="filter: invert(1);width: 10px;height: 6px;margin-left: 5px;">';
          commentHTML += '</p>';
        }
        commentHTML += '</div>';
      });
      commentHTML += '</div></div>';
    }
  }

  // 阅读量
  let readNum = -1;
  const readNumMatchResult = html.match(/var read_num = ['"](?<read_num>\d+)['"] \* 1;/);
  const readNumNewMatchResult = html.match(/var read_num_new = ['"](?<read_num_new>\d+)['"] \* 1;/);
  if (readNumNewMatchResult && readNumNewMatchResult.groups && readNumNewMatchResult.groups.read_num_new) {
    readNum = parseInt(readNumNewMatchResult.groups.read_num_new, 10);
  } else if (readNumMatchResult && readNumMatchResult.groups && readNumMatchResult.groups.read_num) {
    readNum = parseInt(readNumMatchResult.groups.read_num, 10);
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

  // 视频分享消息
  const $js_common_share_desc = $jsArticleContent.querySelector('#js_common_share_desc');
  if ($js_common_share_desc) {
    // 分享视频摘要
    bodyCls +=
      'zh_CN wx_wap_page wx_wap_desktop_fontsize_2 page_share_video white_video_page discuss_tab appmsg_skin_default appmsg_style_default pages_skin_pc';
    const videoContentMatchResult = html.match(
      /(?<code>var\s+videoContentNoEncode\s*=\s*window\.a_value_which_never_exists\s*\|\|\s*(?<value>'[^']+'))/s
    );
    if (videoContentMatchResult && videoContentMatchResult.groups && videoContentMatchResult.groups.value) {
      const code = 'window.videoContentNoEncode = ' + videoContentMatchResult.groups.value;
      eval(code);
      let desc = (window as any).videoContentNoEncode;
      desc = desc.replace(/\r/g, '').replace(/\n/g, '<br>');
      $js_common_share_desc.innerHTML = desc;
    }
  }
  const $js_mpvedio = $jsArticleContent.querySelector('.js_video_channel_container > #js_mpvedio');
  if ($js_mpvedio) {
    // 分享视频
    // poster
    let poster = '';
    const mpVideoCoverUrlMatchResult = html.match(/(?<code>window\.__mpVideoCoverUrl\s*=\s*'[^']*';)/s);
    if (mpVideoCoverUrlMatchResult && mpVideoCoverUrlMatchResult.groups && mpVideoCoverUrlMatchResult.groups.code) {
      const code = mpVideoCoverUrlMatchResult.groups.code;
      eval(code);
      poster = (window as any).__mpVideoCoverUrl;
    }

    // video info
    let videoUrl = '';
    const mpVideoTransInfoMatchResult = html.match(/(?<code>window\.__mpVideoTransInfo\s*=\s*\[.+?];)/s);
    if (mpVideoTransInfoMatchResult && mpVideoTransInfoMatchResult.groups && mpVideoTransInfoMatchResult.groups.code) {
      const code = mpVideoTransInfoMatchResult.groups.code;
      eval(code);
      const mpVideoTransInfo = (window as any).__mpVideoTransInfo;
      if (Array.isArray(mpVideoTransInfo) && mpVideoTransInfo.length > 0) {
        mpVideoTransInfo.forEach((trans: any) => {
          trans.url = trans.url.replace(/&amp;/g, '&');
        });

        // 这里为了节省流量需要控制清晰度
        videoUrl = mpVideoTransInfo[mpVideoTransInfo.length - 1].url;

        // 下载资源
        const videoURLMap = new Map<string, string>();
        const resourceDownloadFn = async (url: string, proxy: string) => {
          const videoData = await downloadAssetWithProxy<Blob>(url, proxy, false, 10);
          const uuid = new Date().getTime() + Math.random().toString();
          const ext = mime.getExtension(videoData.type);
          zip.file(`assets/${uuid}.${ext}`, videoData);

          videoURLMap.set(url, `./assets/${uuid}.${ext}`);
          return videoData.size;
        };

        const urls: string[] = [];
        if (poster) {
          urls.push(poster);
        }
        urls.push(videoUrl);
        await pool.downloads<string>(urls, resourceDownloadFn);

        const div = document.createElement('div');
        div.style.cssText = 'height: 381px;background: #000;border-radius: 4px; overflow: hidden;margin-bottom: 12px;';
        div.innerHTML = `<video src="${videoURLMap.get(videoUrl)}" poster="${videoURLMap.get(poster)}" controls style="width: 100%;height: 100%;"></video>`;
        $js_mpvedio.appendChild(div);
      }
    }
  }

  // 下载内嵌音频
  const mpAudioEls = $jsArticleContent.querySelectorAll<HTMLElement>('mp-common-mpaudio');
  if (mpAudioEls.length > 0) {
    const audioResourceDownloadFn = async (asset: AudioResource, proxy: string) => {
      const audioData = await downloadAssetWithProxy<Blob>(asset.url, proxy, false, 10);
      const uuid = asset.uuid;
      const ext = mime.getExtension(audioData.type);
      zip.file(`assets/${uuid}.${ext}`, audioData);

      let targetEl: HTMLElement | null = null;
      mpAudioEls.forEach(el => {
        const id = el.getAttribute('data-uuid');
        if (id === uuid) {
          targetEl = el;
        }
      });
      if (!targetEl) {
        throw new Error('下载失败');
      }

      if (asset.type === 'cover') {
        (targetEl as HTMLElement).setAttribute('cover', `./assets/${uuid}.${ext}`);
      } else if (asset.type === 'audio') {
        (targetEl as HTMLElement).setAttribute('src', `./assets/${uuid}.${ext}`);
      }

      return audioData.size;
    };

    const assets: AudioResource[] = [];
    mpAudioEls.forEach(mpAudioEl => {
      const uuid = new Date().getTime() + Math.random().toString();
      mpAudioEl.setAttribute('data-uuid', uuid);
      const cover = mpAudioEl.getAttribute('cover')!;
      const voice_encode_fileid = mpAudioEl.getAttribute('voice_encode_fileid')!;
      assets.push({
        uuid: uuid,
        type: 'cover',
        url: cover,
      });
      assets.push({
        uuid: uuid,
        type: 'audio',
        url: 'https://res.wx.qq.com/voice/getvoice?mediaid=' + voice_encode_fileid,
      });
    });

    await pool.downloads<AudioResource>(assets, audioResourceDownloadFn);
  }

  // 下载内嵌视频
  const videoPageInfosMatchResult = html.match(
    /(?<code>var videoPageInfos = \[.+?window.__videoPageInfos = videoPageInfos;)/s
  );
  if (videoPageInfosMatchResult && videoPageInfosMatchResult.groups && videoPageInfosMatchResult.groups.code) {
    const code = videoPageInfosMatchResult.groups.code;
    eval(code);
    const videoPageInfos: VideoPageInfo[] = (window as any).__videoPageInfos;
    videoPageInfos.forEach(videoPageInfo => {
      videoPageInfo.mp_video_trans_info.forEach(trans => {
        trans.url = trans.url.replace(/&amp;/g, '&');
      });
    });

    // 下载资源
    const videoURLMap = new Map<string, string>();
    const resourceDownloadFn = async (url: string, proxy: string) => {
      const videoData = await downloadAssetWithProxy<Blob>(url, proxy, false, 10);
      const uuid = new Date().getTime() + Math.random().toString();
      const ext = mime.getExtension(videoData.type);
      zip.file(`assets/${uuid}.${ext}`, videoData);

      videoURLMap.set(url, `./assets/${uuid}.${ext}`);
      return videoData.size;
    };

    const urls: string[] = [];
    videoPageInfos.forEach(videoPageInfo => {
      if (videoPageInfo.cover_url) {
        urls.push(videoPageInfo.cover_url);
      }
      if (videoPageInfo.is_mp_video === 1 && videoPageInfo.mp_video_trans_info.length > 0) {
        urls.push(videoPageInfo.mp_video_trans_info[0].url);
      }
    });
    await pool.downloads<string>(urls, resourceDownloadFn);

    const videoIframes = $jsArticleContent.querySelectorAll('iframe.video_iframe');
    videoIframes.forEach(videoIframe => {
      const mpvid = videoIframe.getAttribute('data-mpvid');
      if (mpvid) {
        const videoInfo = videoPageInfos.find(info => info.video_id === mpvid);
        if (videoInfo) {
          const div = document.createElement('div');
          div.style.cssText =
            'height: 508px;background: #000;border-radius: 4px; overflow: hidden;margin-bottom: 12px;';
          div.innerHTML = `<video src="${videoURLMap.get(videoInfo.mp_video_trans_info[0]?.url)}" poster="${videoURLMap.get(videoInfo.cover_url)}" controls style="width: 100%;height: 100%;"></video>`;
          videoIframe.replaceWith(div);
        }
      } else {
        const src = videoIframe.getAttribute('data-src')!;
        const vidMatchResult = src.match(/v\.qq\.com\/iframe\/preview\.html\?vid=(?<vid>[\da-z]+)/i);
        if (vidMatchResult && vidMatchResult.groups && vidMatchResult.groups.vid) {
          const vid = vidMatchResult.groups.vid;
          videoIframe.setAttribute('src', 'https://v.qq.com/txp/iframe/player.html?vid=' + vid);
          videoIframe.setAttribute('width', '100%');
        }
      }
    });
  }

  // 下载所有的图片
  const imgDownloadFn = async (img: HTMLImageElement, proxy: string) => {
    const url = img.getAttribute('src') || img.getAttribute('data-src');
    if (!url) {
      return 0;
    }

    const imgData = await downloadAssetWithProxy<Blob>(url, proxy, false, 10);
    const uuid = new Date().getTime() + Math.random().toString();
    const ext = mime.getExtension(imgData.type);
    zip.file(`assets/${uuid}.${ext}`, imgData);

    // 改写html中的引用路径，指向本地图片文件
    img.src = `./assets/${uuid}.${ext}`;

    return imgData.size;
  };
  const imgs = $jsArticleContent.querySelectorAll<HTMLImageElement>('img');
  if (imgs.length > 0) {
    await pool.downloads<HTMLImageElement>([...imgs], imgDownloadFn);
  }

  // 下载背景图片 背景图片无法用选择器选中并修改，因此用正则进行匹配替换
  let pageContentHTML = $jsArticleContent.outerHTML;
  const jsArticleBottomBarHTML = $jsArticleBottomBar?.outerHTML;

  // 收集所有的背景图片地址
  const bgImageURLs = new Set<string>();
  pageContentHTML.replaceAll(
    /((?:background|background-image): url\((?:&quot;)?)((?:https?|\/\/)[^)]+?)((?:&quot;)?\))/gs,
    (_, p1, url, p3) => {
      bgImageURLs.add(url);
      return `${p1}${url}${p3}`;
    }
  );
  if (bgImageURLs.size > 0) {
    // 下载背景图片
    const bgImgDownloadFn = async (url: string, proxy: string) => {
      const imgData = await downloadAssetWithProxy<Blob>(url, proxy, false, 10);
      const uuid = new Date().getTime() + Math.random().toString();
      const ext = mime.getExtension(imgData.type);

      zip.file(`assets/${uuid}.${ext}`, imgData);
      url2pathMap.set(url, `assets/${uuid}.${ext}`);
      return imgData.size;
    };
    const url2pathMap = new Map<string, string>();

    await pool.downloads<string>([...bgImageURLs], bgImgDownloadFn);

    // 替换背景图片路径
    pageContentHTML = pageContentHTML.replaceAll(
      /((?:background|background-image): url\((?:&quot;)?)((?:https?|\/\/)[^)]+?)((?:&quot;)?\))/gs,
      (_, p1, url, p3) => {
        if (url2pathMap.has(url)) {
          const path = url2pathMap.get(url)!;
          return `${p1}./${path}${p3}`;
        } else {
          console.warn('背景图片丢失: ', url);
          return `${p1}${url}${p3}`;
        }
      }
    );
  }

  // 下载样式表
  const linkDownloadFn = async (link: HTMLLinkElement) => {
    const url = link.href;
    let stylesheetFile: Blob | null;

    // 检查缓存
    const cachedAsset = await getAssetCache(url);
    if (cachedAsset) {
      stylesheetFile = cachedAsset.file;
    } else {
      const stylesheet = await request<string>(url, { retry: 1, retryDelay: 2000 });
      stylesheetFile = new Blob([stylesheet], { type: 'text/css' });
      await updateAssetCache({ url: url, file: stylesheetFile, fakeid: fakeid });
    }

    const uuid = new Date().getTime() + Math.random().toString();
    zip.file(`assets/${uuid}.css`, stylesheetFile);
    localLinks += `<link rel="stylesheet" href="./assets/${uuid}.css">\n`;

    return stylesheetFile.size;
  };
  let localLinks: string = '';
  const links = document.querySelectorAll<HTMLLinkElement>('head link[rel="stylesheet"]');
  if (links.length > 0) {
    await pool.downloads<HTMLLinkElement>([...links], linkDownloadFn, false);
  }

  // 处理自定义组件
  const hasMpAudio = $jsArticleContent.querySelector('mp-common-mpaudio') !== null;
  const mpAudioTemplate = `
    <template id="mp-common-mpaudio">
    <style>
        :host {
            all: initial;
            -webkit-text-size-adjust: inherit;
        }
        #audio_progress_bar {
            display: none;
        }
        .js_duration1 {
            display: block;
        }
        .js_duration2 {
            display: none;
        }
    </style>
    <style>
        .wx-root,body,page{--weui-BTN-HEIGHT:48;--weui-BTN-HEIGHT-MEDIUM:40;--weui-BTN-HEIGHT-SMALL:32}.wx-root,body{--weui-BTN-ACTIVE-MASK:rgba(0,0,0,0.1)}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--weui-BTN-ACTIVE-MASK:hsla(0,0%,100%,0.1)}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--weui-BTN-ACTIVE-MASK:hsla(0,0%,100%,0.1)}}.wx-root,body{--weui-BTN-DEFAULT-ACTIVE-BG:#e6e6e6}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--weui-BTN-DEFAULT-ACTIVE-BG:hsla(0,0%,100%,0.126)}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--weui-BTN-DEFAULT-ACTIVE-BG:hsla(0,0%,100%,0.126)}}.wx-root,body{--weui-DIALOG-LINE-COLOR:rgba(0,0,0,0.1)}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--weui-DIALOG-LINE-COLOR:hsla(0,0%,100%,0.1)}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--weui-DIALOG-LINE-COLOR:hsla(0,0%,100%,0.1)}}.weui-hidden_abs{opacity:0;position:absolute;width:1px;height:1px;overflow:hidden}.weui-a11y_ref{display:none}.weui-hidden-space:empty:before{content:"\\00A0";position:absolute;width:1px;height:1px;overflow:hidden}.weui-a11y-combo{position:relative}.weui-a11y-combo__helper{opacity:0;position:absolute;width:100%;height:100%;overflow:hidden}.weui-a11y-combo__content{position:relative;z-index:1}.weui-wa-hotarea-el{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:44px;min-height:44px;width:100%;height:100%}.weui-wa-hotarea,.weui-wa-hotarea-el__wrp,.weui-wa-hotarea_before{position:relative}.weui-wa-hotarea-el__wrp a,.weui-wa-hotarea-el__wrp button,.weui-wa-hotarea-el__wrp navigator,.weui-wa-hotarea_before a,.weui-wa-hotarea_before button,.weui-wa-hotarea_before navigator,.weui-wa-hotarea a,.weui-wa-hotarea button,.weui-wa-hotarea navigator{position:relative;z-index:1}.weui-wa-hotarea:after,.weui-wa-hotarea_before:before{content:"";pointer-events:auto;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);min-width:44px;min-height:44px;width:100%;height:100%}.wx-root,body{--weui-BG-COLOR-ACTIVE:#ececec}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--weui-BG-COLOR-ACTIVE:#373737}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--weui-BG-COLOR-ACTIVE:#373737}}[class*=" weui-icon-"][class*=" weui-icon-"],[class*=" weui-icon-"][class^=weui-icon-],[class^=weui-icon-][class*=" weui-icon-"],[class^=weui-icon-][class^=weui-icon-]{display:inline-block;vertical-align:middle;font-size:10px;width:2.4em;height:2.4em;-webkit-mask-position:50% 50%;mask-position:50% 50%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:100%;mask-size:100%;background-color:currentColor}.weui-icon-circle{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='1000' height='1000' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M500 916.667C269.881 916.667 83.333 730.119 83.333 500 83.333 269.881 269.881 83.333 500 83.333c230.119 0 416.667 186.548 416.667 416.667 0 230.119-186.548 416.667-416.667 416.667zm0-50c202.504 0 366.667-164.163 366.667-366.667 0-202.504-164.163-366.667-366.667-366.667-202.504 0-366.667 164.163-366.667 366.667 0 202.504 164.163 366.667 366.667 366.667z' fill-rule='evenodd' fill-opacity='.9'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='1000' height='1000' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M500 916.667C269.881 916.667 83.333 730.119 83.333 500 83.333 269.881 269.881 83.333 500 83.333c230.119 0 416.667 186.548 416.667 416.667 0 230.119-186.548 416.667-416.667 416.667zm0-50c202.504 0 366.667-164.163 366.667-366.667 0-202.504-164.163-366.667-366.667-366.667-202.504 0-366.667 164.163-366.667 366.667 0 202.504 164.163 366.667 366.667 366.667z' fill-rule='evenodd' fill-opacity='.9'/%3E%3C/svg%3E")}.weui-icon-download{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.25 12.04l-1.72-1.72-1.06 1.06 2.828 2.83a1 1 0 001.414-.001l2.828-2.828-1.06-1.061-1.73 1.73V7h-1.5v5.04zm0-5.04V2h1.5v5h6.251c.55 0 .999.446.999.996v13.008a.998.998 0 01-.996.996H4.996A.998.998 0 014 21.004V7.996A1 1 0 014.999 7h6.251z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11.25 12.04l-1.72-1.72-1.06 1.06 2.828 2.83a1 1 0 001.414-.001l2.828-2.828-1.06-1.061-1.73 1.73V7h-1.5v5.04zm0-5.04V2h1.5v5h6.251c.55 0 .999.446.999.996v13.008a.998.998 0 01-.996.996H4.996A.998.998 0 014 21.004V7.996A1 1 0 014.999 7h6.251z'/%3E%3C/svg%3E")}.weui-icon-info{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.75-12v7h1.5v-7h-1.5zM12 9a1 1 0 100-2 1 1 0 000 2z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.75-12v7h1.5v-7h-1.5zM12 9a1 1 0 100-2 1 1 0 000 2z'/%3E%3C/svg%3E")}.weui-icon-safe-success{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'%3E%3Cpath d='M500.9 4.6C315.5 46.7 180.4 93.1 57.6 132c0 129.3.2 231.7.2 339.7 0 304.2 248.3 471.6 443.1 523.7C695.7 943.3 944 775.9 944 471.7c0-108 .2-210.4.2-339.7C821.4 93.1 686.3 46.7 500.9 4.6zm248.3 349.1l-299.7 295c-2.1 2-5.3 2-7.4-.1L304.4 506.1c-2-2.1-2.3-5.7-.6-8l18.3-24.9c1.7-2.3 5-2.8 7.2-1l112.2 86c2.3 1.8 6 1.7 8.1-.1l274.7-228.9c2.2-1.8 5.7-1.7 7.7.3l17 16.8c2.2 2.1 2.2 5.3.2 7.4z' fill-rule='evenodd' clip-rule='evenodd' fill='%23070202'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'%3E%3Cpath d='M500.9 4.6C315.5 46.7 180.4 93.1 57.6 132c0 129.3.2 231.7.2 339.7 0 304.2 248.3 471.6 443.1 523.7C695.7 943.3 944 775.9 944 471.7c0-108 .2-210.4.2-339.7C821.4 93.1 686.3 46.7 500.9 4.6zm248.3 349.1l-299.7 295c-2.1 2-5.3 2-7.4-.1L304.4 506.1c-2-2.1-2.3-5.7-.6-8l18.3-24.9c1.7-2.3 5-2.8 7.2-1l112.2 86c2.3 1.8 6 1.7 8.1-.1l274.7-228.9c2.2-1.8 5.7-1.7 7.7.3l17 16.8c2.2 2.1 2.2 5.3.2 7.4z' fill-rule='evenodd' clip-rule='evenodd' fill='%23070202'/%3E%3C/svg%3E")}.weui-icon-safe-warn{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'%3E%3Cpath d='M500.9 4.5c-185.4 42-320.4 88.4-443.2 127.3 0 129.3.2 231.7.2 339.6 0 304.1 248.2 471.4 443 523.6 194.7-52.2 443-219.5 443-523.6 0-107.9.2-210.3.2-339.6C821.3 92.9 686.2 46.5 500.9 4.5zm-26.1 271.1h52.1c5.8 0 10.3 4.7 10.1 10.4l-11.6 313.8c-.1 2.8-2.5 5.2-5.4 5.2h-38.2c-2.9 0-5.3-2.3-5.4-5.2L464.8 286c-.2-5.8 4.3-10.4 10-10.4zm26.1 448.3c-20.2 0-36.5-16.3-36.5-36.5s16.3-36.5 36.5-36.5 36.5 16.3 36.5 36.5-16.4 36.5-36.5 36.5z' fill-rule='evenodd' clip-rule='evenodd' fill='%23020202'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1000 1000'%3E%3Cpath d='M500.9 4.5c-185.4 42-320.4 88.4-443.2 127.3 0 129.3.2 231.7.2 339.6 0 304.1 248.2 471.4 443 523.6 194.7-52.2 443-219.5 443-523.6 0-107.9.2-210.3.2-339.6C821.3 92.9 686.2 46.5 500.9 4.5zm-26.1 271.1h52.1c5.8 0 10.3 4.7 10.1 10.4l-11.6 313.8c-.1 2.8-2.5 5.2-5.4 5.2h-38.2c-2.9 0-5.3-2.3-5.4-5.2L464.8 286c-.2-5.8 4.3-10.4 10-10.4zm26.1 448.3c-20.2 0-36.5-16.3-36.5-36.5s16.3-36.5 36.5-36.5 36.5 16.3 36.5 36.5-16.4 36.5-36.5 36.5z' fill-rule='evenodd' clip-rule='evenodd' fill='%23020202'/%3E%3C/svg%3E")}.weui-icon-success{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1.177-7.86l-2.765-2.767L7 12.431l3.119 3.121a1 1 0 001.414 0l5.952-5.95-1.062-1.062-5.6 5.6z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-1.177-7.86l-2.765-2.767L7 12.431l3.119 3.121a1 1 0 001.414 0l5.952-5.95-1.062-1.062-5.6 5.6z'/%3E%3C/svg%3E")}.weui-icon-success-circle{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6zm-1.172-6.242l5.809-5.808.848.849-5.95 5.95a1 1 0 01-1.414 0L7 12.426l.849-.849 2.98 2.98z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6zm-1.172-6.242l5.809-5.808.848.849-5.95 5.95a1 1 0 01-1.414 0L7 12.426l.849-.849 2.98 2.98z'/%3E%3C/svg%3E")}.weui-icon-success-no-circle{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8.657 18.435L3 12.778l1.414-1.414 4.95 4.95L20.678 5l1.414 1.414-12.02 12.021a1 1 0 01-1.415 0z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8.657 18.435L3 12.778l1.414-1.414 4.95 4.95L20.678 5l1.414 1.414-12.02 12.021a1 1 0 01-1.415 0z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-waiting{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.75 11.38V6h-1.5v6l4.243 4.243 1.06-1.06-3.803-3.804zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.75 11.38V6h-1.5v6l4.243 4.243 1.06-1.06-3.803-3.804zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-waiting-circle{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.6 11.503l3.891 3.891-.848.849L11.4 12V6h1.2v5.503zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.6 11.503l3.891 3.891-.848.849L11.4 12V6h1.2v5.503zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6z'/%3E%3C/svg%3E")}.weui-icon-warn{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.763-15.864l.11 7.596h1.305l.11-7.596h-1.525zm.759 10.967c.512 0 .902-.383.902-.882 0-.5-.39-.882-.902-.882a.878.878 0 00-.896.882c0 .499.396.882.896.882z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm-.763-15.864l.11 7.596h1.305l.11-7.596h-1.525zm.759 10.967c.512 0 .902-.383.902-.882 0-.5-.39-.882-.902-.882a.878.878 0 00-.896.882c0 .499.396.882.896.882z'/%3E%3C/svg%3E")}.weui-icon-outlined-warn{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12zm18.8 0a8.8 8.8 0 11-17.6 0 8.8 8.8 0 0117.6 0zm-8.14-5.569l-.089 7.06H11.43l-.088-7.06h1.318zm-1.495 9.807c0 .469.366.835.835.835a.82.82 0 00.835-.835.817.817 0 00-.835-.835.821.821 0 00-.835.835z' fill='%23000'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12zm18.8 0a8.8 8.8 0 11-17.6 0 8.8 8.8 0 0117.6 0zm-8.14-5.569l-.089 7.06H11.43l-.088-7.06h1.318zm-1.495 9.807c0 .469.366.835.835.835a.82.82 0 00.835-.835.817.817 0 00-.835-.835.821.821 0 00-.835.835z' fill='%23000'/%3E%3C/svg%3E")}.weui-icon-info-circle{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6zM11.4 10h1.2v7h-1.2v-7zm.6-1a1 1 0 110-2 1 1 0 010 2z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6zM11.4 10h1.2v7h-1.2v-7zm.6-1a1 1 0 110-2 1 1 0 010 2z'/%3E%3C/svg%3E")}.weui-icon-cancel{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill-rule='evenodd'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6z' fill-rule='nonzero'/%3E%3Cpath d='M12.849 12l3.11 3.111-.848.849L12 12.849l-3.111 3.11-.849-.848L11.151 12l-3.11-3.111.848-.849L12 11.151l3.111-3.11.849.848L12.849 12z'/%3E%3C/g%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill-rule='evenodd'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6z' fill-rule='nonzero'/%3E%3Cpath d='M12.849 12l3.11 3.111-.848.849L12 12.849l-3.111 3.11-.849-.848L11.151 12l-3.11-3.111.848-.849L12 11.151l3.111-3.11.849.848L12.849 12z'/%3E%3C/g%3E%3C/svg%3E")}.weui-icon-search{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16.31 15.561l4.114 4.115-.848.848-4.123-4.123a7 7 0 11.857-.84zM16.8 11a5.8 5.8 0 10-11.6 0 5.8 5.8 0 0011.6 0z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M16.31 15.561l4.114 4.115-.848.848-4.123-4.123a7 7 0 11.857-.84zM16.8 11a5.8 5.8 0 10-11.6 0 5.8 5.8 0 0011.6 0z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-clear{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M13.06 12l3.006-3.005-1.06-1.06L12 10.938 8.995 7.934l-1.06 1.06L10.938 12l-3.005 3.005 1.06 1.06L12 13.062l3.005 3.005 1.06-1.06L13.062 12zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M13.06 12l3.006-3.005-1.06-1.06L12 10.938 8.995 7.934l-1.06 1.06L10.938 12l-3.005 3.005 1.06 1.06L12 13.062l3.005 3.005 1.06-1.06L13.062 12zM12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z'/%3E%3C/svg%3E")}.weui-icon-back{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm1.999-6.563L10.68 12 14 8.562 12.953 7.5 9.29 11.277a1.045 1.045 0 000 1.446l3.663 3.777L14 15.437z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm1.999-6.563L10.68 12 14 8.562 12.953 7.5 9.29 11.277a1.045 1.045 0 000 1.446l3.663 3.777L14 15.437z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-delete{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.774 6.4l.812 13.648a.8.8 0 00.798.752h7.232a.8.8 0 00.798-.752L17.226 6.4H6.774zm11.655 0l-.817 13.719A2 2 0 0115.616 22H8.384a2 2 0 01-1.996-1.881L5.571 6.4H3.5v-.7a.5.5 0 01.5-.5h16a.5.5 0 01.5.5v.7h-2.071zM14 3a.5.5 0 01.5.5v.7h-5v-.7A.5.5 0 0110 3h4zM9.5 9h1.2l.5 9H10l-.5-9zm3.8 0h1.2l-.5 9h-1.2l.5-9z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M6.774 6.4l.812 13.648a.8.8 0 00.798.752h7.232a.8.8 0 00.798-.752L17.226 6.4H6.774zm11.655 0l-.817 13.719A2 2 0 0115.616 22H8.384a2 2 0 01-1.996-1.881L5.571 6.4H3.5v-.7a.5.5 0 01.5-.5h16a.5.5 0 01.5.5v.7h-2.071zM14 3a.5.5 0 01.5.5v.7h-5v-.7A.5.5 0 0110 3h4zM9.5 9h1.2l.5 9H10l-.5-9zm3.8 0h1.2l-.5 9h-1.2l.5-9z'/%3E%3C/svg%3E")}.weui-icon-success-no-circle-thin{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8.864 16.617l-5.303-5.303-1.061 1.06 5.657 5.657a1 1 0 001.414 0L21.238 6.364l-1.06-1.06L8.864 16.616z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M8.864 16.617l-5.303-5.303-1.061 1.06 5.657 5.657a1 1 0 001.414 0L21.238 6.364l-1.06-1.06L8.864 16.616z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-arrow{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='12' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.454 6.58l1.06-1.06 5.78 5.779a.996.996 0 010 1.413l-5.78 5.779-1.06-1.061 5.425-5.425-5.425-5.424z' fill='%23B2B2B2' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='12' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M2.454 6.58l1.06-1.06 5.78 5.779a.996.996 0 010 1.413l-5.78 5.779-1.06-1.061 5.425-5.425-5.425-5.424z' fill='%23B2B2B2' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-arrow-bold{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg height='24' width='12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.157 12.711L4.5 18.368l-1.414-1.414 4.95-4.95-4.95-4.95L4.5 5.64l5.657 5.657a1 1 0 010 1.414z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg height='24' width='12' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10.157 12.711L4.5 18.368l-1.414-1.414 4.95-4.95-4.95-4.95L4.5 5.64l5.657 5.657a1 1 0 010 1.414z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-back-arrow{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='12' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3.343 12l7.071 7.071L9 20.485l-7.778-7.778a1 1 0 010-1.414L9 3.515l1.414 1.414L3.344 12z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='12' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M3.343 12l7.071 7.071L9 20.485l-7.778-7.778a1 1 0 010-1.414L9 3.515l1.414 1.414L3.344 12z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-back-arrow-thin{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='12' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 19.438L8.955 20.5l-7.666-7.79a1.02 1.02 0 010-1.42L8.955 3.5 10 4.563 2.682 12 10 19.438z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='12' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M10 19.438L8.955 20.5l-7.666-7.79a1.02 1.02 0 010-1.42L8.955 3.5 10 4.563 2.682 12 10 19.438z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-close{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12.25 10.693L6.057 4.5 5 5.557l6.193 6.193L5 17.943 6.057 19l6.193-6.193L18.443 19l1.057-1.057-6.193-6.193L19.5 5.557 18.443 4.5l-6.193 6.193z' fill='%23000'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M12.25 10.693L6.057 4.5 5 5.557l6.193 6.193L5 17.943 6.057 19l6.193-6.193L18.443 19l1.057-1.057-6.193-6.193L19.5 5.557 18.443 4.5l-6.193 6.193z' fill='%23000'/%3E%3C/svg%3E")}.weui-icon-close-thin{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.25 10.693L6.057 4.5 5 5.557l6.193 6.193L5 17.943 6.057 19l6.193-6.193L18.443 19l1.057-1.057-6.193-6.193L19.5 5.557 18.443 4.5z' fill-rule='evenodd'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12.25 10.693L6.057 4.5 5 5.557l6.193 6.193L5 17.943 6.057 19l6.193-6.193L18.443 19l1.057-1.057-6.193-6.193L19.5 5.557 18.443 4.5z' fill-rule='evenodd'/%3E%3C/svg%3E")}.weui-icon-back-circle{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6zm1.999-5.363L12.953 16.5 9.29 12.723a1.045 1.045 0 010-1.446L12.953 7.5 14 8.563 10.68 12 14 15.438z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10zm0-1.2a8.8 8.8 0 100-17.6 8.8 8.8 0 000 17.6zm1.999-5.363L12.953 16.5 9.29 12.723a1.045 1.045 0 010-1.446L12.953 7.5 14 8.563 10.68 12 14 15.438z'/%3E%3C/svg%3E")}.weui-icon-success{color:var(--weui-BRAND)}.weui-icon-waiting{color:var(--weui-BLUE)}.weui-icon-warn{color:var(--weui-RED)}.weui-icon-info{color:var(--weui-BLUE)}.weui-icon-success-circle,.weui-icon-success-no-circle,.weui-icon-success-no-circle-thin{color:var(--weui-BRAND)}.weui-icon-waiting-circle{color:var(--weui-BLUE)}.weui-icon-circle{color:var(--weui-FG-2)}.weui-icon-download{color:var(--weui-BRAND)}.weui-icon-info-circle{color:var(--weui-FG-2)}.weui-icon-safe-success{color:var(--weui-BRAND)}.weui-icon-safe-warn{color:var(--weui-YELLOW)}.weui-icon-cancel{color:var(--weui-RED)}.weui-icon-search{color:var(--weui-FG-1)}.weui-icon-clear{color:var(--weui-FG-2)}.weui-icon-clear:active{color:var(--weui-FG-1)}.weui-icon-delete.weui-icon_gallery-delete{color:var(--weui-WHITE)}.weui-icon-arrow-bold.weui-icon-arrow,.weui-icon-arrow-bold.weui-icon-arrow-bold,.weui-icon-arrow-bold.weui-icon-back-arrow,.weui-icon-arrow-bold.weui-icon-back-arrow-thin,.weui-icon-arrow.weui-icon-arrow,.weui-icon-arrow.weui-icon-arrow-bold,.weui-icon-arrow.weui-icon-back-arrow,.weui-icon-arrow.weui-icon-back-arrow-thin,.weui-icon-back-arrow-thin.weui-icon-arrow,.weui-icon-back-arrow-thin.weui-icon-arrow-bold,.weui-icon-back-arrow-thin.weui-icon-back-arrow,.weui-icon-back-arrow-thin.weui-icon-back-arrow-thin,.weui-icon-back-arrow.weui-icon-arrow,.weui-icon-back-arrow.weui-icon-arrow-bold,.weui-icon-back-arrow.weui-icon-back-arrow,.weui-icon-back-arrow.weui-icon-back-arrow-thin{width:1.2em}.weui-icon-arrow,.weui-icon-arrow-bold{color:var(--weui-FG-2)}.weui-icon-back,.weui-icon-back-arrow,.weui-icon-back-arrow-thin,.weui-icon-back-circle{color:var(--weui-FG-0)}.weui-icon_msg.weui-icon_msg{width:6.4em;height:6.4em}.weui-icon_msg.weui-icon_msg.weui-icon-warn{color:var(--weui-RED)}.weui-icon_msg.weui-icon_msg.weui-icon-info-circle{color:var(--weui-BLUE)}.weui-icon_msg-primary.weui-icon_msg-primary{width:6.4em;height:6.4em}.weui-icon_msg-primary.weui-icon_msg-primary.weui-icon-warn{color:var(--weui-YELLOW)}.weui-flex{display:flex}.weui-flex__item{flex:1}.weui-btn{position:relative;display:block;width:184px;margin-left:auto;margin-right:auto;padding:12px 24px;box-sizing:border-box;font-weight:500;font-size:17px;text-align:center;text-decoration:none;color:#fff;line-height:1.41176471;border-radius:8px;-webkit-tap-highlight-color:rgba(0,0,0,0);-webkit-user-select:none;-moz-user-select:none;user-select:none}.weui-btn:active:before{content:"";position:absolute;top:0;left:0;width:100%;height:100%;background-color:var(--weui-BTN-ACTIVE-MASK);border-radius:8px}.weui-btn:active.weui-btn_disabled:before,.weui-btn:active.weui-btn_loading:before,.weui-btn:active[disabled]:before{display:none}.weui-btn_block{width:auto}.weui-btn_inline{display:inline-block}.weui-btn_default{background-color:var(--weui-FG-5)}.weui-btn_default,.weui-btn_default:not(.weui-btn_disabled):visited{color:var(--weui-FG-0)}.weui-btn_primary{background-color:var(--weui-BRAND)}.weui-btn_primary:not(.weui-btn_disabled):visited{color:#fff}.weui-btn_warn{background-color:var(--weui-FG-5)}.weui-btn_warn,.weui-btn_warn:not(.weui-btn_disabled):visited{color:var(--weui-RED)}.weui-btn_overlay{background-color:#fff}.weui-btn_overlay,.weui-btn_overlay:not(.weui-btn_disabled):visited{color:var(--weui-BRAND)}.weui-btn[disabled],.weui-btn_disabled{color:var(--weui-FG-4);background-color:var(--weui-BG-1)}.weui-btn_loading .weui-loading{margin:-.2em 8px 0 0}.weui-btn_loading .weui-mask-loading{margin:-.2em 8px 0 0;color:currentColor}.weui-btn_loading .weui-primary-loading{margin:-.2em 8px 0 0;vertical-align:middle;color:currentColor}.weui-btn_loading .weui-primary-loading:before{content:""}.weui-btn_loading.weui-btn_primary{color:var(--weui-WHITE)}.weui-btn_cell{position:relative;display:block;margin-left:auto;margin-right:auto;box-sizing:border-box;font-size:17px;text-align:center;text-decoration:none;color:#fff;line-height:1.41176471;padding:16px;-webkit-tap-highlight-color:rgba(0,0,0,0);overflow:hidden;background-color:var(--weui-BG-5)}.weui-btn_cell+.weui-btn_cell{margin-top:16px}.weui-btn_cell:active{background-color:var(--weui-BG-COLOR-ACTIVE)}.weui-btn_cell__icon{display:inline-block;vertical-align:middle;width:24px;height:24px;margin:-.2em .34em 0 0}.weui-btn_cell-default{color:var(--weui-FG-0)}.weui-btn_cell-primary{color:var(--weui-LINK)}.weui-btn_cell-warn{color:var(--weui-RED)}.weui-bottom-fixed-opr-page{height:100%;display:flex;flex-direction:column}.weui-bottom-fixed-opr-page__content{min-height:0;flex:1;padding-bottom:80px;box-sizing:border-box;overflow-y:auto;-webkit-overflow-scrolling:touch}.weui-bottom-fixed-opr-page__tool{padding:16px calc(32px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) calc(32px + env(safe-area-inset-left));background:#fff;position:relative;z-index:50}.weui-bottom-fixed-opr-page__tool:before{content:"";height:80px;background:linear-gradient(0deg,#fff,hsla(0,0%,100%,0));position:absolute;bottom:calc(100% - 1px);left:0;right:0;transform:translateZ(0);pointer-events:none}.wx-root[data-weui-theme=dark] .weui-bottom-fixed-opr-page__tool,body[data-weui-theme=dark] .weui-bottom-fixed-opr-page__tool{background:#191919}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]) .weui-bottom-fixed-opr-page__tool,body:not([data-weui-theme=light]) .weui-bottom-fixed-opr-page__tool{background:#191919}}.wx-root[data-weui-theme=dark] .weui-bottom-fixed-opr-page__tool:before,body[data-weui-theme=dark] .weui-bottom-fixed-opr-page__tool:before{background:linear-gradient(0deg,#191919,rgba(25,25,25,0))}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]) .weui-bottom-fixed-opr-page__tool:before,body:not([data-weui-theme=light]) .weui-bottom-fixed-opr-page__tool:before{background:linear-gradient(0deg,#191919,rgba(25,25,25,0))}}.weui-bottom-fixed-opr-page__tips{margin-bottom:24px;padding:0 32px;text-align:center}.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr{display:flex;align-items:center;justify-content:center}.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn{width:184px;padding-left:16px;padding-right:16px}.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2),.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2)+.weui-btn{margin:0 8px;width:136px}.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2)+.weui-btn:first-child,.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2):first-child{margin-left:0}.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2)+.weui-btn:last-child,.weui-bottom-fixed-opr-page .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2):last-child{margin-right:0}.weui-bottom-fixed-opr-page_btn-wrap .weui-bottom-fixed-opr{flex-direction:column}.weui-bottom-fixed-opr-page_btn-wrap .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2),.weui-bottom-fixed-opr-page_btn-wrap .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2)+.weui-btn{width:184px;margin:16px 0 0}.weui-bottom-fixed-opr-page_btn-wrap .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2)+.weui-btn:first-child,.weui-bottom-fixed-opr-page_btn-wrap .weui-bottom-fixed-opr .weui-btn:nth-last-child(n+2):first-child{margin-top:0}.weui-bottom-fixed-opr-page.weui-form{padding-top:0}.weui-bottom-fixed-opr-page.weui-form .weui-form__bd{padding-top:calc(56px + env(safe-area-inset-top))}.weui-bottom-fixed-opr-page.weui-form .weui-form__ft{padding-bottom:0}.weui-bottom-fixed-opr-page.weui-form .weui-form__control-area{margin-bottom:0}.weui-bottom-fixed-opr-page.weui-half-screen-dialog{padding:0}.weui-bottom-fixed-opr-page.weui-half-screen-dialog .weui-half-screen-dialog__bd,.weui-bottom-fixed-opr-page.weui-half-screen-dialog .weui-half-screen-dialog__ft,.weui-bottom-fixed-opr-page.weui-half-screen-dialog .weui-half-screen-dialog__hd{padding-left:calc(24px + env(safe-area-inset-left));padding-right:calc(24px + env(safe-area-inset-right))}.weui-bottom-fixed-opr-page.weui-half-screen-dialog .weui-half-screen-dialog__bd{padding-bottom:80px}.weui-bottom-fixed-opr-page.weui-half-screen-dialog .weui-half-screen-dialog__ft{padding-bottom:calc(64px + env(safe-area-inset-bottom))}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog{padding:0}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog .weui-half-screen-dialog__hd{padding:0 calc(24px + env(safe-area-inset-right)) 0 calc(24px + env(safe-area-inset-left))}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog .weui-half-screen-dialog__bd{padding-bottom:0;display:flex;flex-direction:column}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog .weui-half-screen-dialog__ft{padding:0}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog .weui-bottom-fixed-opr-page{flex:1;min-height:0}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog .weui-bottom-fixed-opr-page__content{padding:0 calc(24px + env(safe-area-inset-right)) 0 calc(24px + env(safe-area-inset-left))}.weui-half-screen-dialog_bottom-fixed.weui-half-screen-dialog .weui-bottom-fixed-opr{padding:16px 0 calc(64px + env(safe-area-inset-bottom))}button.weui-btn,input.weui-btn{border-width:0;outline:0;-webkit-appearance:none}button.weui-btn:focus,input.weui-btn:focus{outline:0}button.weui-btn_inline,button.weui-btn_mini,input.weui-btn_inline,input.weui-btn_mini{width:auto}.weui-btn_medium{font-size:14px;padding:10px 24px;line-height:calc(var(--weui-BTN-HEIGHT-MEDIUM)/14 - 1.42857)}.weui-btn_mini{padding:6px 12px;border-radius:6px}.weui-btn_mini,.weui-btn_xmini{display:inline-block;width:auto;line-height:1.42857;font-size:14px}.weui-btn_xmini{padding:4px 12px;font-weight:500;border-radius:4px}.weui-btn+.weui-btn{margin-top:16px}.weui-btn.weui-btn_mini+.weui-btn.weui-btn_mini,.weui-btn.weui-btn_xmini+.weui-btn.weui-btn_xmini{margin-top:auto}.weui-btn.weui-btn_inline+.weui-btn.weui-btn_inline{margin-left:16px}.weui-btn-area{margin:48px 16px 8px}.weui-btn-area_inline{display:flex}.weui-btn-area_inline .weui-btn{margin-top:auto;margin-right:16px;width:100%;flex:1}.weui-btn-area_inline .weui-btn:last-child{margin-right:0}.weui-btn_reset{font-size:inherit}.weui-btn_icon,.weui-btn_reset{background:transparent;border:0;padding:0;outline:0}.weui-btn_icon{font-size:0}.weui-btn_icon:active [class*=weui-icon-]{color:var(--weui-FG-1)}.wx-root,body{--weui-BG-0:#ededed;--weui-BG-1:#f7f7f7;--weui-BG-2:#fff;--weui-BG-3:#f7f7f7;--weui-BG-4:#4c4c4c;--weui-BG-5:#fff;--weui-BLUE-100:#10aeff;--weui-BLUE-120:#3fbeff;--weui-BLUE-170:#b7e6ff;--weui-BLUE-80:#0c8bcc;--weui-BLUE-90:#0e9ce6;--weui-BLUE-BG-100:#48a6e2;--weui-BLUE-BG-110:#5aafe4;--weui-BLUE-BG-130:#7fc0ea;--weui-BLUE-BG-90:#4095cb;--weui-BRAND-100:#07c160;--weui-BRAND-120:#38cd7f;--weui-BRAND-170:#b4ecce;--weui-BRAND-80:#059a4c;--weui-BRAND-90:#06ae56;--weui-BRAND-BG-100:#2aae67;--weui-BRAND-BG-110:#3eb575;--weui-BRAND-BG-130:#69c694;--weui-BRAND-BG-90:#259c5c;--weui-FG-0:rgba(0,0,0,0.9);--weui-FG-0_5:rgba(0,0,0,0.9);--weui-FG-1:rgba(0,0,0,0.55);--weui-FG-2:rgba(0,0,0,0.3);--weui-FG-3:rgba(0,0,0,0.1);--weui-FG-4:rgba(0,0,0,0.15);--weui-GLYPH-0:rgba(0,0,0,0.9);--weui-GLYPH-1:rgba(0,0,0,0.55);--weui-GLYPH-2:rgba(0,0,0,0.3);--weui-GLYPH-WHITE-0:hsla(0,0%,100%,0.8);--weui-GLYPH-WHITE-1:hsla(0,0%,100%,0.5);--weui-GLYPH-WHITE-2:hsla(0,0%,100%,0.3);--weui-GLYPH-WHITE-3:#fff;--weui-GREEN-100:#91d300;--weui-GREEN-120:#a7db33;--weui-GREEN-170:#def1b3;--weui-GREEN-80:#74a800;--weui-GREEN-90:#82bd00;--weui-GREEN-BG-100:#96be40;--weui-GREEN-BG-110:#a0c452;--weui-GREEN-BG-130:#b5d179;--weui-GREEN-BG-90:#86aa39;--weui-INDIGO-100:#1485ee;--weui-INDIGO-120:#439df1;--weui-INDIGO-170:#b8daf9;--weui-INDIGO-80:#106abe;--weui-INDIGO-90:#1277d6;--weui-INDIGO-BG-100:#2b77bf;--weui-INDIGO-BG-110:#3f84c5;--weui-INDIGO-BG-130:#6ba0d2;--weui-INDIGO-BG-90:#266aab;--weui-LIGHTGREEN-100:#95ec69;--weui-LIGHTGREEN-120:#aaef87;--weui-LIGHTGREEN-170:#def9d1;--weui-LIGHTGREEN-80:#77bc54;--weui-LIGHTGREEN-90:#85d35e;--weui-LIGHTGREEN-BG-100:#72cf60;--weui-LIGHTGREEN-BG-110:#80d370;--weui-LIGHTGREEN-BG-130:#9cdd90;--weui-LIGHTGREEN-BG-90:#66b956;--weui-LINK-100:#576b95;--weui-LINK-120:#7888aa;--weui-LINK-170:#ccd2de;--weui-LINK-80:#455577;--weui-LINK-90:#4e6085;--weui-LINKFINDER-100:#002666;--weui-MATERIAL-ATTACHMENTCOLUMN:hsla(0,0%,96.1%,0.95);--weui-MATERIAL-NAVIGATIONBAR:hsla(0,0%,92.9%,0.94);--weui-MATERIAL-REGULAR:hsla(0,0%,96.9%,0.3);--weui-MATERIAL-THICK:hsla(0,0%,96.9%,0.8);--weui-MATERIAL-THIN:hsla(0,0%,100%,0.2);--weui-MATERIAL-TOOLBAR:hsla(0,0%,96.5%,0.82);--weui-ORANGE-100:#fa9d3b;--weui-ORANGE-120:#fbb062;--weui-ORANGE-170:#fde1c3;--weui-ORANGE-80:#c87d2f;--weui-ORANGE-90:#e08c34;--weui-ORANGE-BG-100:#ea7800;--weui-ORANGE-BG-110:#ec8519;--weui-ORANGE-BG-130:#f0a04d;--weui-ORANGE-BG-90:#d26b00;--weui-ORANGERED-100:#ff6146;--weui-OVERLAY:rgba(0,0,0,0.5);--weui-OVERLAY-WHITE:hsla(0,0%,94.9%,0.8);--weui-PURPLE-100:#6467f0;--weui-PURPLE-120:#8385f3;--weui-PURPLE-170:#d0d1fa;--weui-PURPLE-80:#5052c0;--weui-PURPLE-90:#595cd7;--weui-PURPLE-BG-100:#6769ba;--weui-PURPLE-BG-110:#7678c1;--weui-PURPLE-BG-130:#9496ce;--weui-PURPLE-BG-90:#5c5ea7;--weui-RED-100:#fa5151;--weui-RED-120:#fb7373;--weui-RED-170:#fdcaca;--weui-RED-80:#c84040;--weui-RED-90:#e14949;--weui-RED-BG-100:#cf5148;--weui-RED-BG-110:#d3625a;--weui-RED-BG-130:#dd847e;--weui-RED-BG-90:#b94840;--weui-SECONDARY-BG:rgba(0,0,0,0.05);--weui-SEPARATOR-0:rgba(0,0,0,0.1);--weui-SEPARATOR-1:rgba(0,0,0,0.15);--weui-STATELAYER-HOVERED:rgba(0,0,0,0.02);--weui-STATELAYER-PRESSED:rgba(0,0,0,0.1);--weui-STATELAYER-PRESSEDSTRENGTHENED:rgba(0,0,0,0.2);--weui-YELLOW-100:#ffc300;--weui-YELLOW-120:#ffcf33;--weui-YELLOW-170:#ffecb2;--weui-YELLOW-80:#cc9c00;--weui-YELLOW-90:#e6af00;--weui-YELLOW-BG-100:#efb600;--weui-YELLOW-BG-110:#f0bd19;--weui-YELLOW-BG-130:#f3cc4d;--weui-YELLOW-BG-90:#d7a400;--weui-FG-HALF:rgba(0,0,0,0.9);--weui-RED:#fa5151;--weui-ORANGERED:#ff6146;--weui-ORANGE:#fa9d3b;--weui-YELLOW:#ffc300;--weui-GREEN:#91d300;--weui-LIGHTGREEN:#95ec69;--weui-TEXTGREEN:#06ae56;--weui-BRAND:#07c160;--weui-BLUE:#10aeff;--weui-INDIGO:#1485ee;--weui-PURPLE:#6467f0;--weui-LINK:#576b95;--weui-TAG-TEXT-ORANGE:#fa9d3b;--weui-TAG-TEXT-GREEN:#06ae56;--weui-TAG-TEXT-BLUE:#10aeff;--weui-REDORANGE:#ff6146;--weui-TAG-TEXT-BLACK:rgba(0,0,0,0.5);--weui-TAG-BACKGROUND-BLACK:rgba(0,0,0,0.05);--weui-WHITE:#fff;--weui-BG:#fff;--weui-FG:#000;--weui-FG-5:rgba(0,0,0,0.05);--weui-TAG-BACKGROUND-ORANGE:rgba(250,157,59,0.1);--weui-TAG-BACKGROUND-GREEN:rgba(6,174,86,0.1);--weui-TAG-TEXT-RED:rgba(250,81,81,0.6);--weui-TAG-BACKGROUND-RED:rgba(250,81,81,0.1);--weui-TAG-BACKGROUND-BLUE:rgba(16,174,255,0.1)}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--weui-BG-0:#111;--weui-BG-1:#1e1e1e;--weui-BG-2:#191919;--weui-BG-3:#202020;--weui-BG-4:#404040;--weui-BG-5:#2c2c2c;--weui-BLUE-100:#10aeff;--weui-BLUE-120:#0c8bcc;--weui-BLUE-170:#04344d;--weui-BLUE-80:#3fbeff;--weui-BLUE-90:#28b6ff;--weui-BLUE-BG-100:#48a6e2;--weui-BLUE-BG-110:#4095cb;--weui-BLUE-BG-130:#32749e;--weui-BLUE-BG-90:#5aafe4;--weui-BRAND-100:#07c160;--weui-BRAND-120:#059a4c;--weui-BRAND-170:#023a1c;--weui-BRAND-80:#38cd7f;--weui-BRAND-90:#20c770;--weui-BRAND-BG-100:#2aae67;--weui-BRAND-BG-110:#259c5c;--weui-BRAND-BG-130:#1d7a48;--weui-BRAND-BG-90:#3eb575;--weui-FG-0:hsla(0,0%,100%,0.8);--weui-FG-0_5:hsla(0,0%,100%,0.6);--weui-FG-1:hsla(0,0%,100%,0.5);--weui-FG-2:hsla(0,0%,100%,0.3);--weui-FG-3:hsla(0,0%,100%,0.1);--weui-FG-4:hsla(0,0%,100%,0.15);--weui-GLYPH-0:hsla(0,0%,100%,0.8);--weui-GLYPH-1:hsla(0,0%,100%,0.5);--weui-GLYPH-2:hsla(0,0%,100%,0.3);--weui-GLYPH-WHITE-0:hsla(0,0%,100%,0.8);--weui-GLYPH-WHITE-1:hsla(0,0%,100%,0.5);--weui-GLYPH-WHITE-2:hsla(0,0%,100%,0.3);--weui-GLYPH-WHITE-3:#fff;--weui-GREEN-100:#74a800;--weui-GREEN-120:#5c8600;--weui-GREEN-170:#233200;--weui-GREEN-80:#8fb933;--weui-GREEN-90:#82b01a;--weui-GREEN-BG-100:#789833;--weui-GREEN-BG-110:#6b882d;--weui-GREEN-BG-130:#65802b;--weui-GREEN-BG-90:#85a247;--weui-INDIGO-100:#1196ff;--weui-INDIGO-120:#0d78cc;--weui-INDIGO-170:#052d4d;--weui-INDIGO-80:#40abff;--weui-INDIGO-90:#28a0ff;--weui-INDIGO-BG-100:#0d78cc;--weui-INDIGO-BG-110:#0b6bb7;--weui-INDIGO-BG-130:#09548f;--weui-INDIGO-BG-90:#2585d1;--weui-LIGHTGREEN-100:#3eb575;--weui-LIGHTGREEN-120:#31905d;--weui-LIGHTGREEN-170:#123522;--weui-LIGHTGREEN-80:#64c390;--weui-LIGHTGREEN-90:#51bc83;--weui-LIGHTGREEN-BG-100:#31905d;--weui-LIGHTGREEN-BG-110:#2c8153;--weui-LIGHTGREEN-BG-130:#226541;--weui-LIGHTGREEN-BG-90:#31905d;--weui-LINK-100:#7d90a9;--weui-LINK-120:#647387;--weui-LINK-170:#252a32;--weui-LINK-80:#97a6ba;--weui-LINK-90:#899ab1;--weui-LINKFINDER-100:#dee9ff;--weui-MATERIAL-ATTACHMENTCOLUMN:rgba(32,32,32,0.93);--weui-MATERIAL-NAVIGATIONBAR:rgba(18,18,18,0.9);--weui-MATERIAL-REGULAR:rgba(37,37,37,0.6);--weui-MATERIAL-THICK:rgba(34,34,34,0.9);--weui-MATERIAL-THIN:rgba(95,95,95,0.4);--weui-MATERIAL-TOOLBAR:rgba(35,35,35,0.93);--weui-ORANGE-100:#c87d2f;--weui-ORANGE-120:#a06425;--weui-ORANGE-170:#3b250e;--weui-ORANGE-80:#d39758;--weui-ORANGE-90:#cd8943;--weui-ORANGE-BG-100:#bb6000;--weui-ORANGE-BG-110:#a85600;--weui-ORANGE-BG-130:#824300;--weui-ORANGE-BG-90:#c1701a;--weui-ORANGERED-100:#ff6146;--weui-OVERLAY:rgba(0,0,0,0.8);--weui-OVERLAY-WHITE:hsla(0,0%,94.9%,0.8);--weui-PURPLE-100:#8183ff;--weui-PURPLE-120:#6768cc;--weui-PURPLE-170:#26274c;--weui-PURPLE-80:#9a9bff;--weui-PURPLE-90:#8d8fff;--weui-PURPLE-BG-100:#6768cc;--weui-PURPLE-BG-110:#5c5db7;--weui-PURPLE-BG-130:#48498f;--weui-PURPLE-BG-90:#7677d1;--weui-RED-100:#fa5151;--weui-RED-120:#c84040;--weui-RED-170:#4b1818;--weui-RED-80:#fb7373;--weui-RED-90:#fa6262;--weui-RED-BG-100:#cf5148;--weui-RED-BG-110:#ba4940;--weui-RED-BG-130:#913832;--weui-RED-BG-90:#d3625a;--weui-SECONDARY-BG:hsla(0,0%,100%,0.1);--weui-SEPARATOR-0:hsla(0,0%,100%,0.05);--weui-SEPARATOR-1:hsla(0,0%,100%,0.15);--weui-STATELAYER-HOVERED:rgba(0,0,0,0.02);--weui-STATELAYER-PRESSED:hsla(0,0%,100%,0.1);--weui-STATELAYER-PRESSEDSTRENGTHENED:hsla(0,0%,100%,0.2);--weui-YELLOW-100:#cc9c00;--weui-YELLOW-120:#a37c00;--weui-YELLOW-170:#3d2f00;--weui-YELLOW-80:#d6af33;--weui-YELLOW-90:#d1a519;--weui-YELLOW-BG-100:#bf9100;--weui-YELLOW-BG-110:#ab8200;--weui-YELLOW-BG-130:#866500;--weui-YELLOW-BG-90:#c59c1a;--weui-FG-HALF:hsla(0,0%,100%,0.6);--weui-RED:#fa5151;--weui-ORANGERED:#ff6146;--weui-ORANGE:#c87d2f;--weui-YELLOW:#cc9c00;--weui-GREEN:#74a800;--weui-LIGHTGREEN:#3eb575;--weui-TEXTGREEN:#259c5c;--weui-BRAND:#07c160;--weui-BLUE:#10aeff;--weui-INDIGO:#1196ff;--weui-PURPLE:#8183ff;--weui-LINK:#7d90a9;--weui-REDORANGE:#ff6146;--weui-TAG-TEXT-BLACK:hsla(0,0%,100%,0.5);--weui-TAG-BACKGROUND-BLACK:hsla(0,0%,100%,0.05);--weui-WHITE:hsla(0,0%,100%,0.8);--weui-FG:#fff;--weui-BG:#000;--weui-FG-5:hsla(0,0%,100%,0.1);--weui-TAG-BACKGROUND-ORANGE:rgba(250,157,59,0.1);--weui-TAG-BACKGROUND-GREEN:rgba(6,174,86,0.1);--weui-TAG-TEXT-RED:rgba(250,81,81,0.6);--weui-TAG-BACKGROUND-RED:rgba(250,81,81,0.1);--weui-TAG-BACKGROUND-BLUE:rgba(16,174,255,0.1);--weui-TAG-TEXT-ORANGE:rgba(250,157,59,0.6);--weui-TAG-TEXT-GREEN:rgba(6,174,86,0.6);--weui-TAG-TEXT-BLUE:rgba(16,174,255,0.6)}}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--weui-BG-0:#111;--weui-BG-1:#1e1e1e;--weui-BG-2:#191919;--weui-BG-3:#202020;--weui-BG-4:#404040;--weui-BG-5:#2c2c2c;--weui-BLUE-100:#10aeff;--weui-BLUE-120:#0c8bcc;--weui-BLUE-170:#04344d;--weui-BLUE-80:#3fbeff;--weui-BLUE-90:#28b6ff;--weui-BLUE-BG-100:#48a6e2;--weui-BLUE-BG-110:#4095cb;--weui-BLUE-BG-130:#32749e;--weui-BLUE-BG-90:#5aafe4;--weui-BRAND-100:#07c160;--weui-BRAND-120:#059a4c;--weui-BRAND-170:#023a1c;--weui-BRAND-80:#38cd7f;--weui-BRAND-90:#20c770;--weui-BRAND-BG-100:#2aae67;--weui-BRAND-BG-110:#259c5c;--weui-BRAND-BG-130:#1d7a48;--weui-BRAND-BG-90:#3eb575;--weui-FG-0:hsla(0,0%,100%,0.8);--weui-FG-0_5:hsla(0,0%,100%,0.6);--weui-FG-1:hsla(0,0%,100%,0.5);--weui-FG-2:hsla(0,0%,100%,0.3);--weui-FG-3:hsla(0,0%,100%,0.1);--weui-FG-4:hsla(0,0%,100%,0.15);--weui-GLYPH-0:hsla(0,0%,100%,0.8);--weui-GLYPH-1:hsla(0,0%,100%,0.5);--weui-GLYPH-2:hsla(0,0%,100%,0.3);--weui-GLYPH-WHITE-0:hsla(0,0%,100%,0.8);--weui-GLYPH-WHITE-1:hsla(0,0%,100%,0.5);--weui-GLYPH-WHITE-2:hsla(0,0%,100%,0.3);--weui-GLYPH-WHITE-3:#fff;--weui-GREEN-100:#74a800;--weui-GREEN-120:#5c8600;--weui-GREEN-170:#233200;--weui-GREEN-80:#8fb933;--weui-GREEN-90:#82b01a;--weui-GREEN-BG-100:#789833;--weui-GREEN-BG-110:#6b882d;--weui-GREEN-BG-130:#65802b;--weui-GREEN-BG-90:#85a247;--weui-INDIGO-100:#1196ff;--weui-INDIGO-120:#0d78cc;--weui-INDIGO-170:#052d4d;--weui-INDIGO-80:#40abff;--weui-INDIGO-90:#28a0ff;--weui-INDIGO-BG-100:#0d78cc;--weui-INDIGO-BG-110:#0b6bb7;--weui-INDIGO-BG-130:#09548f;--weui-INDIGO-BG-90:#2585d1;--weui-LIGHTGREEN-100:#3eb575;--weui-LIGHTGREEN-120:#31905d;--weui-LIGHTGREEN-170:#123522;--weui-LIGHTGREEN-80:#64c390;--weui-LIGHTGREEN-90:#51bc83;--weui-LIGHTGREEN-BG-100:#31905d;--weui-LIGHTGREEN-BG-110:#2c8153;--weui-LIGHTGREEN-BG-130:#226541;--weui-LIGHTGREEN-BG-90:#31905d;--weui-LINK-100:#7d90a9;--weui-LINK-120:#647387;--weui-LINK-170:#252a32;--weui-LINK-80:#97a6ba;--weui-LINK-90:#899ab1;--weui-LINKFINDER-100:#dee9ff;--weui-MATERIAL-ATTACHMENTCOLUMN:rgba(32,32,32,0.93);--weui-MATERIAL-NAVIGATIONBAR:rgba(18,18,18,0.9);--weui-MATERIAL-REGULAR:rgba(37,37,37,0.6);--weui-MATERIAL-THICK:rgba(34,34,34,0.9);--weui-MATERIAL-THIN:rgba(95,95,95,0.4);--weui-MATERIAL-TOOLBAR:rgba(35,35,35,0.93);--weui-ORANGE-100:#c87d2f;--weui-ORANGE-120:#a06425;--weui-ORANGE-170:#3b250e;--weui-ORANGE-80:#d39758;--weui-ORANGE-90:#cd8943;--weui-ORANGE-BG-100:#bb6000;--weui-ORANGE-BG-110:#a85600;--weui-ORANGE-BG-130:#824300;--weui-ORANGE-BG-90:#c1701a;--weui-ORANGERED-100:#ff6146;--weui-OVERLAY:rgba(0,0,0,0.8);--weui-OVERLAY-WHITE:hsla(0,0%,94.9%,0.8);--weui-PURPLE-100:#8183ff;--weui-PURPLE-120:#6768cc;--weui-PURPLE-170:#26274c;--weui-PURPLE-80:#9a9bff;--weui-PURPLE-90:#8d8fff;--weui-PURPLE-BG-100:#6768cc;--weui-PURPLE-BG-110:#5c5db7;--weui-PURPLE-BG-130:#48498f;--weui-PURPLE-BG-90:#7677d1;--weui-RED-100:#fa5151;--weui-RED-120:#c84040;--weui-RED-170:#4b1818;--weui-RED-80:#fb7373;--weui-RED-90:#fa6262;--weui-RED-BG-100:#cf5148;--weui-RED-BG-110:#ba4940;--weui-RED-BG-130:#913832;--weui-RED-BG-90:#d3625a;--weui-SECONDARY-BG:hsla(0,0%,100%,0.1);--weui-SEPARATOR-0:hsla(0,0%,100%,0.05);--weui-SEPARATOR-1:hsla(0,0%,100%,0.15);--weui-STATELAYER-HOVERED:rgba(0,0,0,0.02);--weui-STATELAYER-PRESSED:hsla(0,0%,100%,0.1);--weui-STATELAYER-PRESSEDSTRENGTHENED:hsla(0,0%,100%,0.2);--weui-YELLOW-100:#cc9c00;--weui-YELLOW-120:#a37c00;--weui-YELLOW-170:#3d2f00;--weui-YELLOW-80:#d6af33;--weui-YELLOW-90:#d1a519;--weui-YELLOW-BG-100:#bf9100;--weui-YELLOW-BG-110:#ab8200;--weui-YELLOW-BG-130:#866500;--weui-YELLOW-BG-90:#c59c1a;--weui-FG-HALF:hsla(0,0%,100%,0.6);--weui-RED:#fa5151;--weui-ORANGERED:#ff6146;--weui-ORANGE:#c87d2f;--weui-YELLOW:#cc9c00;--weui-GREEN:#74a800;--weui-LIGHTGREEN:#3eb575;--weui-TEXTGREEN:#259c5c;--weui-BRAND:#07c160;--weui-BLUE:#10aeff;--weui-INDIGO:#1196ff;--weui-PURPLE:#8183ff;--weui-LINK:#7d90a9;--weui-REDORANGE:#ff6146;--weui-TAG-TEXT-BLACK:hsla(0,0%,100%,0.5);--weui-TAG-BACKGROUND-BLACK:hsla(0,0%,100%,0.05);--weui-WHITE:hsla(0,0%,100%,0.8);--weui-FG:#fff;--weui-BG:#000;--weui-FG-5:hsla(0,0%,100%,0.1);--weui-TAG-BACKGROUND-ORANGE:rgba(250,157,59,0.1);--weui-TAG-BACKGROUND-GREEN:rgba(6,174,86,0.1);--weui-TAG-TEXT-RED:rgba(250,81,81,0.6);--weui-TAG-BACKGROUND-RED:rgba(250,81,81,0.1);--weui-TAG-BACKGROUND-BLUE:rgba(16,174,255,0.1);--weui-TAG-TEXT-ORANGE:rgba(250,157,59,0.6);--weui-TAG-TEXT-GREEN:rgba(6,174,86,0.6);--weui-TAG-TEXT-BLUE:rgba(16,174,255,0.6)}.wx-root[data-weui-mode=care],body[data-weui-mode=care]{--weui-BG-0:#ededed;--weui-BG-1:#f7f7f7;--weui-BG-2:#fff;--weui-BG-3:#f7f7f7;--weui-BG-4:#4c4c4c;--weui-BG-5:#fff;--weui-BLUE-100:#007dbb;--weui-BLUE-120:#3fbeff;--weui-BLUE-170:#b7e6ff;--weui-BLUE-80:#0c8bcc;--weui-BLUE-90:#0e9ce6;--weui-BLUE-BG-100:#48a6e2;--weui-BLUE-BG-110:#5aafe4;--weui-BLUE-BG-130:#7fc0ea;--weui-BLUE-BG-90:#4095cb;--weui-BRAND-100:#018942;--weui-BRAND-120:#38cd7f;--weui-BRAND-170:#b4ecce;--weui-BRAND-80:#059a4c;--weui-BRAND-90:#06ae56;--weui-BRAND-BG-100:#2aae67;--weui-BRAND-BG-110:#3eb575;--weui-BRAND-BG-130:#69c694;--weui-BRAND-BG-90:#259c5c;--weui-FG-0:#000;--weui-FG-0_5:#000;--weui-FG-1:rgba(0,0,0,0.6);--weui-FG-2:rgba(0,0,0,0.42);--weui-FG-3:rgba(0,0,0,0.1);--weui-FG-4:rgba(0,0,0,0.15);--weui-GLYPH-0:#000;--weui-GLYPH-1:rgba(0,0,0,0.6);--weui-GLYPH-2:rgba(0,0,0,0.42);--weui-GLYPH-WHITE-0:hsla(0,0%,100%,0.85);--weui-GLYPH-WHITE-1:hsla(0,0%,100%,0.55);--weui-GLYPH-WHITE-2:hsla(0,0%,100%,0.35);--weui-GLYPH-WHITE-3:#fff;--weui-GREEN-100:#4f8400;--weui-GREEN-120:#a7db33;--weui-GREEN-170:#def1b3;--weui-GREEN-80:#74a800;--weui-GREEN-90:#82bd00;--weui-GREEN-BG-100:#96be40;--weui-GREEN-BG-110:#a0c452;--weui-GREEN-BG-130:#b5d179;--weui-GREEN-BG-90:#86aa39;--weui-INDIGO-100:#0075e2;--weui-INDIGO-120:#439df1;--weui-INDIGO-170:#b8daf9;--weui-INDIGO-80:#106abe;--weui-INDIGO-90:#1277d6;--weui-INDIGO-BG-100:#2b77bf;--weui-INDIGO-BG-110:#3f84c5;--weui-INDIGO-BG-130:#6ba0d2;--weui-INDIGO-BG-90:#266aab;--weui-LIGHTGREEN-100:#2e8800;--weui-LIGHTGREEN-120:#aaef87;--weui-LIGHTGREEN-170:#def9d1;--weui-LIGHTGREEN-80:#77bc54;--weui-LIGHTGREEN-90:#85d35e;--weui-LIGHTGREEN-BG-100:#72cf60;--weui-LIGHTGREEN-BG-110:#80d370;--weui-LIGHTGREEN-BG-130:#9cdd90;--weui-LIGHTGREEN-BG-90:#66b956;--weui-LINK-100:#576b95;--weui-LINK-120:#7888aa;--weui-LINK-170:#ccd2de;--weui-LINK-80:#455577;--weui-LINK-90:#4e6085;--weui-LINKFINDER-100:#002666;--weui-MATERIAL-ATTACHMENTCOLUMN:hsla(0,0%,96.1%,0.95);--weui-MATERIAL-NAVIGATIONBAR:hsla(0,0%,92.9%,0.94);--weui-MATERIAL-REGULAR:hsla(0,0%,96.9%,0.3);--weui-MATERIAL-THICK:hsla(0,0%,96.9%,0.8);--weui-MATERIAL-THIN:hsla(0,0%,100%,0.2);--weui-MATERIAL-TOOLBAR:hsla(0,0%,96.5%,0.82);--weui-ORANGE-100:#e17719;--weui-ORANGE-120:#fbb062;--weui-ORANGE-170:#fde1c3;--weui-ORANGE-80:#c87d2f;--weui-ORANGE-90:#e08c34;--weui-ORANGE-BG-100:#ea7800;--weui-ORANGE-BG-110:#ec8519;--weui-ORANGE-BG-130:#f0a04d;--weui-ORANGE-BG-90:#d26b00;--weui-ORANGERED-100:#d14730;--weui-OVERLAY:rgba(0,0,0,0.5);--weui-OVERLAY-WHITE:hsla(0,0%,94.9%,0.8);--weui-PURPLE-100:#6265f1;--weui-PURPLE-120:#8385f3;--weui-PURPLE-170:#d0d1fa;--weui-PURPLE-80:#5052c0;--weui-PURPLE-90:#595cd7;--weui-PURPLE-BG-100:#6769ba;--weui-PURPLE-BG-110:#7678c1;--weui-PURPLE-BG-130:#9496ce;--weui-PURPLE-BG-90:#5c5ea7;--weui-RED-100:#dc3636;--weui-RED-120:#fb7373;--weui-RED-170:#fdcaca;--weui-RED-80:#c84040;--weui-RED-90:#e14949;--weui-RED-BG-100:#cf5148;--weui-RED-BG-110:#d3625a;--weui-RED-BG-130:#dd847e;--weui-RED-BG-90:#b94840;--weui-SECONDARY-BG:rgba(0,0,0,0.1);--weui-SEPARATOR-0:rgba(0,0,0,0.1);--weui-SEPARATOR-1:rgba(0,0,0,0.15);--weui-STATELAYER-HOVERED:rgba(0,0,0,0.02);--weui-STATELAYER-PRESSED:rgba(0,0,0,0.1);--weui-STATELAYER-PRESSEDSTRENGTHENED:rgba(0,0,0,0.2);--weui-YELLOW-100:#bb8e00;--weui-YELLOW-120:#ffcf33;--weui-YELLOW-170:#ffecb2;--weui-YELLOW-80:#cc9c00;--weui-YELLOW-90:#e6af00;--weui-YELLOW-BG-100:#efb600;--weui-YELLOW-BG-110:#f0bd19;--weui-YELLOW-BG-130:#f3cc4d;--weui-YELLOW-BG-90:#d7a400;--weui-FG-HALF:#000;--weui-RED:#dc3636;--weui-ORANGERED:#d14730;--weui-ORANGE:#e17719;--weui-YELLOW:#bb8e00;--weui-GREEN:#4f8400;--weui-LIGHTGREEN:#2e8800;--weui-TEXTGREEN:#06ae56;--weui-BRAND:#018942;--weui-BLUE:#007dbb;--weui-INDIGO:#0075e2;--weui-PURPLE:#6265f1;--weui-LINK:#576b95;--weui-TAG-TEXT-ORANGE:#e17719;--weui-TAG-TEXT-GREEN:#06ae56;--weui-TAG-TEXT-BLUE:#007dbb;--weui-REDORANGE:#d14730;--weui-TAG-TEXT-BLACK:rgba(0,0,0,0.5);--weui-WHITE:#fff;--weui-BG:#fff;--weui-FG:#000;--weui-FG-5:rgba(0,0,0,0.05);--weui-TAG-BACKGROUND-ORANGE:rgba(225,119,25,0.1);--weui-TAG-BACKGROUND-GREEN:rgba(6,174,86,0.1);--weui-TAG-TEXT-RED:rgba(250,81,81,0.6);--weui-TAG-BACKGROUND-RED:rgba(250,81,81,0.1);--weui-TAG-BACKGROUND-BLUE:rgba(0,125,187,0.1);--weui-TAG-BACKGROUND-BLACK:rgba(0,0,0,0.05)}@media (prefers-color-scheme:dark){.wx-root[data-weui-mode=care]:not([data-weui-theme=light]),body[data-weui-mode=care]:not([data-weui-theme=light]){--weui-BG-0:#111;--weui-BG-1:#1e1e1e;--weui-BG-2:#191919;--weui-BG-3:#202020;--weui-BG-4:#404040;--weui-BG-5:#2c2c2c;--weui-BLUE-100:#10aeff;--weui-BLUE-120:#0c8bcc;--weui-BLUE-170:#04344d;--weui-BLUE-80:#3fbeff;--weui-BLUE-90:#28b6ff;--weui-BLUE-BG-100:#48a6e2;--weui-BLUE-BG-110:#4095cb;--weui-BLUE-BG-130:#32749e;--weui-BLUE-BG-90:#5aafe4;--weui-BRAND-100:#07c160;--weui-BRAND-120:#059a4c;--weui-BRAND-170:#023a1c;--weui-BRAND-80:#38cd7f;--weui-BRAND-90:#20c770;--weui-BRAND-BG-100:#2aae67;--weui-BRAND-BG-110:#259c5c;--weui-BRAND-BG-130:#1d7a48;--weui-BRAND-BG-90:#3eb575;--weui-FG-0:hsla(0,0%,100%,0.85);--weui-FG-0_5:hsla(0,0%,100%,0.65);--weui-FG-1:hsla(0,0%,100%,0.55);--weui-FG-2:hsla(0,0%,100%,0.35);--weui-FG-3:hsla(0,0%,100%,0.1);--weui-FG-4:hsla(0,0%,100%,0.15);--weui-GLYPH-0:hsla(0,0%,100%,0.85);--weui-GLYPH-1:hsla(0,0%,100%,0.55);--weui-GLYPH-2:hsla(0,0%,100%,0.35);--weui-GLYPH-WHITE-0:hsla(0,0%,100%,0.85);--weui-GLYPH-WHITE-1:hsla(0,0%,100%,0.55);--weui-GLYPH-WHITE-2:hsla(0,0%,100%,0.35);--weui-GLYPH-WHITE-3:#fff;--weui-GREEN-100:#74a800;--weui-GREEN-120:#5c8600;--weui-GREEN-170:#233200;--weui-GREEN-80:#8fb933;--weui-GREEN-90:#82b01a;--weui-GREEN-BG-100:#789833;--weui-GREEN-BG-110:#6b882d;--weui-GREEN-BG-130:#65802b;--weui-GREEN-BG-90:#85a247;--weui-INDIGO-100:#1196ff;--weui-INDIGO-120:#0d78cc;--weui-INDIGO-170:#052d4d;--weui-INDIGO-80:#40abff;--weui-INDIGO-90:#28a0ff;--weui-INDIGO-BG-100:#0d78cc;--weui-INDIGO-BG-110:#0b6bb7;--weui-INDIGO-BG-130:#09548f;--weui-INDIGO-BG-90:#2585d1;--weui-LIGHTGREEN-100:#3eb575;--weui-LIGHTGREEN-120:#31905d;--weui-LIGHTGREEN-170:#123522;--weui-LIGHTGREEN-80:#64c390;--weui-LIGHTGREEN-90:#51bc83;--weui-LIGHTGREEN-BG-100:#31905d;--weui-LIGHTGREEN-BG-110:#2c8153;--weui-LIGHTGREEN-BG-130:#226541;--weui-LIGHTGREEN-BG-90:#31905d;--weui-LINK-100:#7d90a9;--weui-LINK-120:#647387;--weui-LINK-170:#252a32;--weui-LINK-80:#97a6ba;--weui-LINK-90:#899ab1;--weui-LINKFINDER-100:#dee9ff;--weui-MATERIAL-ATTACHMENTCOLUMN:rgba(32,32,32,0.93);--weui-MATERIAL-NAVIGATIONBAR:rgba(18,18,18,0.9);--weui-MATERIAL-REGULAR:rgba(37,37,37,0.6);--weui-MATERIAL-THICK:rgba(34,34,34,0.9);--weui-MATERIAL-THIN:hsla(0,0%,96.1%,0.4);--weui-MATERIAL-TOOLBAR:rgba(35,35,35,0.93);--weui-ORANGE-100:#c87d2f;--weui-ORANGE-120:#a06425;--weui-ORANGE-170:#3b250e;--weui-ORANGE-80:#d39758;--weui-ORANGE-90:#cd8943;--weui-ORANGE-BG-100:#bb6000;--weui-ORANGE-BG-110:#a85600;--weui-ORANGE-BG-130:#824300;--weui-ORANGE-BG-90:#c1701a;--weui-ORANGERED-100:#ff6146;--weui-OVERLAY:rgba(0,0,0,0.8);--weui-OVERLAY-WHITE:hsla(0,0%,94.9%,0.8);--weui-PURPLE-100:#8183ff;--weui-PURPLE-120:#6768cc;--weui-PURPLE-170:#26274c;--weui-PURPLE-80:#9a9bff;--weui-PURPLE-90:#8d8fff;--weui-PURPLE-BG-100:#6768cc;--weui-PURPLE-BG-110:#5c5db7;--weui-PURPLE-BG-130:#48498f;--weui-PURPLE-BG-90:#7677d1;--weui-RED-100:#fa5151;--weui-RED-120:#c84040;--weui-RED-170:#4b1818;--weui-RED-80:#fb7373;--weui-RED-90:#fa6262;--weui-RED-BG-100:#cf5148;--weui-RED-BG-110:#ba4940;--weui-RED-BG-130:#913832;--weui-RED-BG-90:#d3625a;--weui-SECONDARY-BG:hsla(0,0%,100%,0.15);--weui-SEPARATOR-0:hsla(0,0%,100%,0.05);--weui-SEPARATOR-1:hsla(0,0%,100%,0.15);--weui-STATELAYER-HOVERED:rgba(0,0,0,0.02);--weui-STATELAYER-PRESSED:hsla(0,0%,100%,0.1);--weui-STATELAYER-PRESSEDSTRENGTHENED:hsla(0,0%,100%,0.2);--weui-YELLOW-100:#cc9c00;--weui-YELLOW-120:#a37c00;--weui-YELLOW-170:#3d2f00;--weui-YELLOW-80:#d6af33;--weui-YELLOW-90:#d1a519;--weui-YELLOW-BG-100:#bf9100;--weui-YELLOW-BG-110:#ab8200;--weui-YELLOW-BG-130:#866500;--weui-YELLOW-BG-90:#c59c1a;--weui-FG-HALF:hsla(0,0%,100%,0.65);--weui-RED:#fa5151;--weui-ORANGERED:#ff6146;--weui-ORANGE:#c87d2f;--weui-YELLOW:#cc9c00;--weui-GREEN:#74a800;--weui-LIGHTGREEN:#3eb575;--weui-TEXTGREEN:#259c5c;--weui-BRAND:#07c160;--weui-BLUE:#10aeff;--weui-INDIGO:#1196ff;--weui-PURPLE:#8183ff;--weui-LINK:#7d90a9;--weui-REDORANGE:#ff6146;--weui-TAG-BACKGROUND-BLACK:hsla(0,0%,100%,0.05);--weui-FG:#fff;--weui-WHITE:hsla(0,0%,100%,0.8);--weui-FG-5:hsla(0,0%,100%,0.1);--weui-TAG-BACKGROUND-ORANGE:rgba(250,157,59,0.1);--weui-TAG-BACKGROUND-GREEN:rgba(6,174,86,0.1);--weui-TAG-TEXT-RED:rgba(250,81,81,0.6);--weui-TAG-BACKGROUND-RED:rgba(250,81,81,0.1);--weui-TAG-BACKGROUND-BLUE:rgba(16,174,255,0.1);--weui-TAG-TEXT-ORANGE:rgba(250,157,59,0.6);--weui-BG:#000;--weui-TAG-TEXT-GREEN:rgba(6,174,86,0.6);--weui-TAG-TEXT-BLUE:rgba(16,174,255,0.6);--weui-TAG-TEXT-BLACK:hsla(0,0%,100%,0.5)}}.wx-root[data-weui-mode=care][data-weui-theme=dark],body[data-weui-mode=care][data-weui-theme=dark]{--weui-BG-0:#111;--weui-BG-1:#1e1e1e;--weui-BG-2:#191919;--weui-BG-3:#202020;--weui-BG-4:#404040;--weui-BG-5:#2c2c2c;--weui-BLUE-100:#10aeff;--weui-BLUE-120:#0c8bcc;--weui-BLUE-170:#04344d;--weui-BLUE-80:#3fbeff;--weui-BLUE-90:#28b6ff;--weui-BLUE-BG-100:#48a6e2;--weui-BLUE-BG-110:#4095cb;--weui-BLUE-BG-130:#32749e;--weui-BLUE-BG-90:#5aafe4;--weui-BRAND-100:#07c160;--weui-BRAND-120:#059a4c;--weui-BRAND-170:#023a1c;--weui-BRAND-80:#38cd7f;--weui-BRAND-90:#20c770;--weui-BRAND-BG-100:#2aae67;--weui-BRAND-BG-110:#259c5c;--weui-BRAND-BG-130:#1d7a48;--weui-BRAND-BG-90:#3eb575;--weui-FG-0:hsla(0,0%,100%,0.85);--weui-FG-0_5:hsla(0,0%,100%,0.65);--weui-FG-1:hsla(0,0%,100%,0.55);--weui-FG-2:hsla(0,0%,100%,0.35);--weui-FG-3:hsla(0,0%,100%,0.1);--weui-FG-4:hsla(0,0%,100%,0.15);--weui-GLYPH-0:hsla(0,0%,100%,0.85);--weui-GLYPH-1:hsla(0,0%,100%,0.55);--weui-GLYPH-2:hsla(0,0%,100%,0.35);--weui-GLYPH-WHITE-0:hsla(0,0%,100%,0.85);--weui-GLYPH-WHITE-1:hsla(0,0%,100%,0.55);--weui-GLYPH-WHITE-2:hsla(0,0%,100%,0.35);--weui-GLYPH-WHITE-3:#fff;--weui-GREEN-100:#74a800;--weui-GREEN-120:#5c8600;--weui-GREEN-170:#233200;--weui-GREEN-80:#8fb933;--weui-GREEN-90:#82b01a;--weui-GREEN-BG-100:#789833;--weui-GREEN-BG-110:#6b882d;--weui-GREEN-BG-130:#65802b;--weui-GREEN-BG-90:#85a247;--weui-INDIGO-100:#1196ff;--weui-INDIGO-120:#0d78cc;--weui-INDIGO-170:#052d4d;--weui-INDIGO-80:#40abff;--weui-INDIGO-90:#28a0ff;--weui-INDIGO-BG-100:#0d78cc;--weui-INDIGO-BG-110:#0b6bb7;--weui-INDIGO-BG-130:#09548f;--weui-INDIGO-BG-90:#2585d1;--weui-LIGHTGREEN-100:#3eb575;--weui-LIGHTGREEN-120:#31905d;--weui-LIGHTGREEN-170:#123522;--weui-LIGHTGREEN-80:#64c390;--weui-LIGHTGREEN-90:#51bc83;--weui-LIGHTGREEN-BG-100:#31905d;--weui-LIGHTGREEN-BG-110:#2c8153;--weui-LIGHTGREEN-BG-130:#226541;--weui-LIGHTGREEN-BG-90:#31905d;--weui-LINK-100:#7d90a9;--weui-LINK-120:#647387;--weui-LINK-170:#252a32;--weui-LINK-80:#97a6ba;--weui-LINK-90:#899ab1;--weui-LINKFINDER-100:#dee9ff;--weui-MATERIAL-ATTACHMENTCOLUMN:rgba(32,32,32,0.93);--weui-MATERIAL-NAVIGATIONBAR:rgba(18,18,18,0.9);--weui-MATERIAL-REGULAR:rgba(37,37,37,0.6);--weui-MATERIAL-THICK:rgba(34,34,34,0.9);--weui-MATERIAL-THIN:hsla(0,0%,96.1%,0.4);--weui-MATERIAL-TOOLBAR:rgba(35,35,35,0.93);--weui-ORANGE-100:#c87d2f;--weui-ORANGE-120:#a06425;--weui-ORANGE-170:#3b250e;--weui-ORANGE-80:#d39758;--weui-ORANGE-90:#cd8943;--weui-ORANGE-BG-100:#bb6000;--weui-ORANGE-BG-110:#a85600;--weui-ORANGE-BG-130:#824300;--weui-ORANGE-BG-90:#c1701a;--weui-ORANGERED-100:#ff6146;--weui-OVERLAY:rgba(0,0,0,0.8);--weui-OVERLAY-WHITE:hsla(0,0%,94.9%,0.8);--weui-PURPLE-100:#8183ff;--weui-PURPLE-120:#6768cc;--weui-PURPLE-170:#26274c;--weui-PURPLE-80:#9a9bff;--weui-PURPLE-90:#8d8fff;--weui-PURPLE-BG-100:#6768cc;--weui-PURPLE-BG-110:#5c5db7;--weui-PURPLE-BG-130:#48498f;--weui-PURPLE-BG-90:#7677d1;--weui-RED-100:#fa5151;--weui-RED-120:#c84040;--weui-RED-170:#4b1818;--weui-RED-80:#fb7373;--weui-RED-90:#fa6262;--weui-RED-BG-100:#cf5148;--weui-RED-BG-110:#ba4940;--weui-RED-BG-130:#913832;--weui-RED-BG-90:#d3625a;--weui-SECONDARY-BG:hsla(0,0%,100%,0.15);--weui-SEPARATOR-0:hsla(0,0%,100%,0.05);--weui-SEPARATOR-1:hsla(0,0%,100%,0.15);--weui-STATELAYER-HOVERED:rgba(0,0,0,0.02);--weui-STATELAYER-PRESSED:hsla(0,0%,100%,0.1);--weui-STATELAYER-PRESSEDSTRENGTHENED:hsla(0,0%,100%,0.2);--weui-YELLOW-100:#cc9c00;--weui-YELLOW-120:#a37c00;--weui-YELLOW-170:#3d2f00;--weui-YELLOW-80:#d6af33;--weui-YELLOW-90:#d1a519;--weui-YELLOW-BG-100:#bf9100;--weui-YELLOW-BG-110:#ab8200;--weui-YELLOW-BG-130:#866500;--weui-YELLOW-BG-90:#c59c1a;--weui-FG-HALF:hsla(0,0%,100%,0.65);--weui-RED:#fa5151;--weui-ORANGERED:#ff6146;--weui-ORANGE:#c87d2f;--weui-YELLOW:#cc9c00;--weui-GREEN:#74a800;--weui-LIGHTGREEN:#3eb575;--weui-TEXTGREEN:#259c5c;--weui-BRAND:#07c160;--weui-BLUE:#10aeff;--weui-INDIGO:#1196ff;--weui-PURPLE:#8183ff;--weui-LINK:#7d90a9;--weui-REDORANGE:#ff6146;--weui-TAG-BACKGROUND-BLACK:hsla(0,0%,100%,0.05);--weui-FG:#fff;--weui-WHITE:hsla(0,0%,100%,0.8);--weui-FG-5:hsla(0,0%,100%,0.1);--weui-TAG-BACKGROUND-ORANGE:rgba(250,157,59,0.1);--weui-TAG-BACKGROUND-GREEN:rgba(6,174,86,0.1);--weui-TAG-TEXT-RED:rgba(250,81,81,0.6);--weui-TAG-BACKGROUND-RED:rgba(250,81,81,0.1);--weui-TAG-BACKGROUND-BLUE:rgba(16,174,255,0.1);--weui-TAG-TEXT-ORANGE:rgba(250,157,59,0.6);--weui-BG:#000;--weui-TAG-TEXT-GREEN:rgba(6,174,86,0.6);--weui-TAG-TEXT-BLUE:rgba(16,174,255,0.6);--weui-TAG-TEXT-BLACK:hsla(0,0%,100%,0.5)}.weui-flex__item{min-width:0}.weui-flex_align-center{align-items:center}.weui-icon-filled-arrow{-webkit-mask-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='24' viewBox='0 0 12 24'%3E  %3Cpath fill-opacity='.9' fill-rule='evenodd' d='M10.157 12.711L4.5 18.368l-1.414-1.414 4.95-4.95-4.95-4.95L4.5 5.64l5.657 5.657a1 1 0 0 1 0 1.414z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='24' viewBox='0 0 12 24'%3E  %3Cpath fill-opacity='.9' fill-rule='evenodd' d='M10.157 12.711L4.5 18.368l-1.414-1.414 4.95-4.95-4.95-4.95L4.5 5.64l5.657 5.657a1 1 0 0 1 0 1.414z'/%3E%3C/svg%3E")}.weui-icon-outlined-arrow{-webkit-mask-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='24' viewBox='0 0 12 24'%3E  %3Cpath fill-opacity='.9' fill-rule='evenodd' d='M2.454 6.58l1.06-1.06 5.78 5.779a.996.996 0 0 1 0 1.413l-5.78 5.779-1.06-1.061 5.425-5.425-5.425-5.424z'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='24' viewBox='0 0 12 24'%3E  %3Cpath fill-opacity='.9' fill-rule='evenodd' d='M2.454 6.58l1.06-1.06 5.78 5.779a.996.996 0 0 1 0 1.413l-5.78 5.779-1.06-1.061 5.425-5.425-5.425-5.424z'/%3E%3C/svg%3E")}.weui-icon-medium-channels{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M2.69 5.047c.43-1.043 1.103-1.306 1.59-1.343 1.078-.069 2.79.644 6.622 7.004.28.467.713 1.204 1.095 1.858.381-.654.814-1.391 1.095-1.858 3.83-6.36 5.544-7.073 6.62-7.004.489.037 1.162.3 1.592 1.343 1.1 2.662-.598 10.758-2.31 13.768-.46.811-1.118 1.493-2.101 1.487-1.931 0-3.851-2.889-4.896-4.77-1.046 1.881-2.966 4.77-4.896 4.77-.984.006-1.642-.676-2.101-1.487C3.288 15.805 1.589 7.71 2.69 5.047zm6.713 6.564C7.513 8.475 6.228 6.875 5.369 6.08c-.419-.389-.685-.536-.817-.592a.556.556 0 00-.102-.034l-.008.01a1.113 1.113 0 00-.134.25l-.001.002c-.13.313-.242 1.013-.212 2.136.028 1.066.177 2.329.416 3.633.488 2.662 1.297 5.213 2.01 6.465l.001.003c.166.292.31.456.413.536.075.06.109.064.155.063h.01c.08 0 .388-.062.935-.549.514-.457 1.043-1.116 1.537-1.852a21.642 21.642 0 001.248-2.128l-.255-.437c-.4-.687-.869-1.488-1.162-1.975zm5.188 0c1.89-3.136 3.174-4.736 4.033-5.531.42-.389.686-.536.817-.592a.554.554 0 01.102-.034l.008.01c.029.038.079.115.135.25v.002c.13.313.242 1.013.213 2.136-.029 1.066-.177 2.329-.417 3.633-.488 2.662-1.297 5.213-2.01 6.465l-.001.003c-.165.292-.31.456-.413.536-.075.06-.108.064-.155.063h-.01c-.08 0-.388-.062-.935-.549-.514-.457-1.042-1.116-1.537-1.852a21.645 21.645 0 01-1.248-2.128l.255-.437c.4-.687.87-1.488 1.163-1.975z' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M2.69 5.047c.43-1.043 1.103-1.306 1.59-1.343 1.078-.069 2.79.644 6.622 7.004.28.467.713 1.204 1.095 1.858.381-.654.814-1.391 1.095-1.858 3.83-6.36 5.544-7.073 6.62-7.004.489.037 1.162.3 1.592 1.343 1.1 2.662-.598 10.758-2.31 13.768-.46.811-1.118 1.493-2.101 1.487-1.931 0-3.851-2.889-4.896-4.77-1.046 1.881-2.966 4.77-4.896 4.77-.984.006-1.642-.676-2.101-1.487C3.288 15.805 1.589 7.71 2.69 5.047zm6.713 6.564C7.513 8.475 6.228 6.875 5.369 6.08c-.419-.389-.685-.536-.817-.592a.556.556 0 00-.102-.034l-.008.01a1.113 1.113 0 00-.134.25l-.001.002c-.13.313-.242 1.013-.212 2.136.028 1.066.177 2.329.416 3.633.488 2.662 1.297 5.213 2.01 6.465l.001.003c.166.292.31.456.413.536.075.06.109.064.155.063h.01c.08 0 .388-.062.935-.549.514-.457 1.043-1.116 1.537-1.852a21.642 21.642 0 001.248-2.128l-.255-.437c-.4-.687-.869-1.488-1.162-1.975zm5.188 0c1.89-3.136 3.174-4.736 4.033-5.531.42-.389.686-.536.817-.592a.554.554 0 01.102-.034l.008.01c.029.038.079.115.135.25v.002c.13.313.242 1.013.213 2.136-.029 1.066-.177 2.329-.417 3.633-.488 2.662-1.297 5.213-2.01 6.465l-.001.003c-.165.292-.31.456-.413.536-.075.06-.108.064-.155.063h-.01c-.08 0-.388-.062-.935-.549-.514-.457-1.042-1.116-1.537-1.852a21.645 21.645 0 01-1.248-2.128l.255-.437c.4-.687.87-1.488 1.163-1.975z' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E");color:var(--weui-ORANGE)}[tabindex]{outline:0}.wx-root{pointer-events:auto;font-family:system-ui,-apple-system,BlinkMacSystemFont,Helvetica Neue,PingFang SC,Hiragino Sans GB,Microsoft YaHei UI,Microsoft YaHei,Arial,sans-serif}.wx-root,.wx_card_root{position:relative}.wxw_hide{display:none!important}.wx_uninteractive{pointer-events:none}.wx-root,body{--APPMSGCARD-BG:#fafafa}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--APPMSGCARD-BG:#1e1e1e}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--APPMSGCARD-BG:#1e1e1e}}.wx-root,body{--APPMSGCARD-LINE-BG:rgba(0,0,0,0.07)}.wx-root[data-weui-theme=dark],body[data-weui-theme=dark]{--APPMSGCARD-LINE-BG:hsla(0,0%,100%,0.07)}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]),body:not([data-weui-theme=light]){--APPMSGCARD-LINE-BG:hsla(0,0%,100%,0.07)}}.appmsg_card_context{position:relative;background-color:var(--APPMSGCARD-BG);border-radius:8px;-webkit-user-select:none;-moz-user-select:none;user-select:none;-webkit-tap-highlight-color:rgba(0,0,0,0)}.appmsg_card_context:hover{cursor:pointer}:host(.wx_tap_highlight_active) .wx_tap_link{opacity:.5}:host(.wx_tap_highlight_active) .wx_tap_card{background-color:#f3f3f3}:host(.wx_tap_highlight_active) .wx_tap_cell{background-color:rgba(0,0,0,.05)}@media (prefers-color-scheme:dark){:host(.wx_tap_highlight_active) .wx_tap_card{background-color:#252525}:host(.wx_tap_highlight_active) .wx_tap_cell{background-color:hsla(0,0%,100%,.1)}}.wx_css_active :active{opacity:.5}.pages_ban_msg_wrp{position:relative}.pages_ban_msg{background:var(--weui-BG-3);color:var(--weui-FG-2);font-size:14px;font-weight:400;font-style:normal;line-height:1.4;position:absolute;z-index:50;top:0;left:0;width:100%;height:100%;padding:16px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;text-align:center;border-radius:4px}.pages_ban_msg a,.pages_ban_msg button{cursor:pointer}.pages_ban_msg_web{background:hsla(0,0%,96.9%,.95);color:var(--weui-FG-1)}.weui-icon-filled-listen-later{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.15 3v2.35H9.5v1.8H7.15V9.5h-1.8V7.15H3v-1.8h2.35V3h1.8zM11 5.35h10v1.8H11v-1.8zm10 6.5H5v1.8h16v-1.8zm0 6H5v1.8h16v-1.8z' fill='%23000'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.15 3v2.35H9.5v1.8H7.15V9.5h-1.8V7.15H3v-1.8h2.35V3h1.8zM11 5.35h10v1.8H11v-1.8zm10 6.5H5v1.8h16v-1.8zm0 6H5v1.8h16v-1.8z' fill='%23000'/%3E%3C/svg%3E")}.weui-icon-filled-listen-later-added{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.53 8.53l5.5-5.5-1.06-1.06L7 6.94 4.53 4.47 3.47 5.53l3 3 .53.53.53-.53zM21 5.5h-7.7V7H21V5.5zM5 11.85h16v1.5H5v-1.5zm0 6h16v1.5H5v-1.5z' fill='%23000'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M13 5.35h8v1.8h-8v-1.8zm8 6.5H5v1.8h16v-1.8zm0 6H5v1.8h16v-1.8z' fill='%23000'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.53 8.53l5.5-5.5-1.06-1.06L7 6.94 4.53 4.47 3.47 5.53l3 3 .53.53.53-.53zM21 5.5h-7.7V7H21V5.5zM5 11.85h16v1.5H5v-1.5zm0 6h16v1.5H5v-1.5z' fill='%23000'/%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M13 5.35h8v1.8h-8v-1.8zm8 6.5H5v1.8h16v-1.8zm0 6H5v1.8h16v-1.8z' fill='%23000'/%3E%3C/svg%3E")}.weui-icon-filled-play{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.496 4.855l10.985 6.277a1 1 0 010 1.736L7.496 19.145A1 1 0 016 18.277V5.723a1 1 0 011.496-.868z' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M7.496 4.855l10.985 6.277a1 1 0 010 1.736L7.496 19.145A1 1 0 016 18.277V5.723a1 1 0 011.496-.868z' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E")}.weui-icon-filled-pause{-webkit-mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 5.5a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1v-13zm9 0a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1v-13z' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M5.5 5.5a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1v-13zm9 0a1 1 0 011-1h2a1 1 0 011 1v13a1 1 0 01-1 1h-2a1 1 0 01-1-1v-13z' fill='%23000' fill-opacity='.9'/%3E%3C/svg%3E")}.audio_card{overflow:hidden;line-height:1.4;-webkit-tap-highlight-color:rgba(0,0,0,0)}.audio_card_bd{display:block}.audio_card_title{display:block;font-weight:500;font-size:17px;color:var(--weui-FG-0);overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;word-wrap:break-word;-webkit-hyphens:auto;hyphens:auto}.audio_card_desc-time{margin-top:12px;align-items:center}.audio_card_desc{margin-top:2px;font-size:14px;color:var(--weui-FG-2)}.audio_card_desc_meta{flex-shrink:0}.audio_card_desc_meta+.audio_card_desc_meta{margin-left:8px}.audio_card_nickname{width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;word-wrap:normal;flex-shrink:1}.audio_card_opr{margin-left:8px;display:flex}.audio_card_opr .weui-btn_icon{flex-shrink:0;margin-left:16px;color:var(--weui-FG-0)}.audio_card_ft{display:block;color:var(--weui-FG-2);font-size:14px;position:relative}.audio_card_ft:before{content:" ";position:absolute;left:0;top:0;right:0;height:1px;border-top:1px solid var(--APPMSGCARD-LINE-BG);color:var(--APPMSGCARD-LINE-BG);transform-origin:0 0;transform:scaleY(.5);left:16px;right:16px}.common-web.audio_card{width:382px;margin:0 auto}.audio_card_progress_wrp{display:block;position:relative;height:4px;outline:0;-webkit-tap-highlight-color:rgba(0,0,0,0)}.audio_card_progress{position:absolute;height:2px;left:0;right:0;top:50%;transform:translateY(-50%);background:rgba(0,0,0,.1);border-radius:2px;overflow:hidden}.audio_card_progress_inner{position:absolute;top:0;left:0;height:100%;background:var(--weui-FG-0);z-index:1}.audio_card_progress_buffer{position:absolute;top:0;left:0;bottom:0;background:rgba(0,0,0,.19)}.audio_card_progress_loading{position:absolute;top:0;bottom:0;left:0;right:0;overflow:hidden}.audio_card_progress_loading:before{position:absolute;top:0;bottom:0;left:0;width:200%;animation:slidein 6s linear infinite normal;background-image:repeating-linear-gradient(-15deg,rgba(0,0,0,.19),rgba(0,0,0,.19) 2px,rgba(0,0,0,.1) 0,rgba(0,0,0,.1) 4px)}.audio_card_progress_handle{outline:0;-webkit-tap-highlight-color:rgba(0,0,0,0);cursor:pointer;z-index:2;width:14px;height:14px;top:50%;margin:-7px 0 0 -7px}.audio_card_progress_handle:before{content:"";position:absolute;width:4px;height:4px;top:50%;left:50%;margin-top:-2px;margin-left:-2px;background:var(--weui-FG-0);border-radius:50%;transition:width .15s linear,height .15s linear}.audio_card_progress_handle.audio_card_progress_handle{position:absolute}.audio_card_progress_handle:active:before{width:8px;height:8px;margin-top:-4px;margin-left:-4px}@keyframes slidein{0%{transform:translateX(-50%)}to{transform:translateX(0)}}.audio_card_switch_btn .weui-icon-filled-pause,.share_audio_playing .audio_card_switch_btn .weui-icon-filled-play{display:none}.share_audio_playing .audio_card_switch_btn .weui-icon-filled-pause{display:inline-block}.audio_card_bd{padding:16px}.audio_card_progress_wrp{margin-top:16px}.wx-root[data-weui-theme=dark] .audio_card_progress{background:hsla(0,0%,100%,.1)}.wx-root[data-weui-theme=dark] .audio_card_progress_buffer{background:hsla(0,0%,100%,.19)}.wx-root[data-weui-theme=dark] .audio_card_progress_loading:before{background-image:repeating-linear-gradient(-15deg,hsla(0,0%,100%,.19),hsla(0,0%,100%,.19) 2px,hsla(0,0%,100%,.1) 0,hsla(0,0%,100%,.1) 4px)}@media (prefers-color-scheme:dark){.wx-root:not([data-weui-theme=light]) .audio_card_progress{background:hsla(0,0%,100%,.1)}.wx-root:not([data-weui-theme=light]) .audio_card_progress_buffer{background:hsla(0,0%,100%,.19)}.wx-root:not([data-weui-theme=light]) .audio_card_progress_loading:before{background-image:repeating-linear-gradient(-15deg,hsla(0,0%,100%,.19),hsla(0,0%,100%,.19) 2px,hsla(0,0%,100%,.1) 0,hsla(0,0%,100%,.1) 4px)}}.audio_card_thumb{display:block;flex-shrink:0;font-size:64px;width:1em;height:1em;background-size:cover;margin-right:12px;border-radius:2px;position:relative;background-color:#e3e4e5}.audio_card .pages_ban_msg{flex-direction:column;flex-wrap:wrap}.audio_card .pages_ban_msg:before{content:"";display:block;width:20px;height:20px;background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath fill-rule='evenodd' clip-rule='evenodd' d='M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2 2 6.477 2 12zm18.8 0a8.8 8.8 0 11-17.6 0 8.8 8.8 0 0117.6 0zm-8.2-2v7h-1.2v-7h1.2zM12 9a1 1 0 100-2 1 1 0 000 2z' fill='%23000' fill-opacity='.3'/%3E%3C/svg%3E");background-repeat:no-repeat;background-size:cover;margin-bottom:4px}.wx_hover_card:before{border-radius:8px;border:1px solid rgba(7,193,96,.3)}.wx_hover_card:before,.wx_selected_card:before{content:" ";position:absolute;top:0;left:0;right:0;bottom:0;box-sizing:border-box;pointer-events:none}.wx_selected_card:before{border-radius:8px;border:1.5px solid #07c160;background:rgba(7,193,96,.1)}.audio_card_album{padding:16px;position:relative}.audio_card_album:after{position:absolute;left:0;top:0;right:0;bottom:0;border-bottom-left-radius:8px;border-bottom-right-radius:8px;background:var(--weui-TAG-BACKGROUND-BLACK);overflow:hidden}.wx_tap_highlight_active .audio_card_album:after{content:""}.audio_card_album_name{color:var(--weui-FG-1);display:block;width:auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;word-wrap:normal}.audio_card_album_num{flex-shrink:0;margin-left:20px;display:flex;align-items:center}.audio_card_album_num .weui-icon-outlined-arrow{width:.8em;height:1.8em;margin-left:2px}.audio_card_bd{padding:24px 16px}.audio_card_progress_wrp{margin-bottom:-8px}.audio_album_card .audio_card_bd{padding:16px}.audio_album_card .audio_card_progress_wrp{margin-bottom:-12px}.audio_album_card.share_audio_pause .audio_card_ft:before,.audio_album_card.share_audio_playing .audio_card_ft:before{display:none}
    </style>
    <div class="common-webchat wx-root wx_tap_card appmsg_card_context audio_card wx_mpaudio_card wx_card_root js_wx_mpaudio_card share_audio_pause">
        <span class="audio_card_bd">
            <span>
                <span role="link" tabindex="0" class="audio_card_info weui-flex__item weui-flex weui-flex_align-center">
                    <img class="audio_card_thumb" src="" alt="">
                    <span role="option" class="weui-flex__item">
                        <strong class="audio_card_title"></strong>
                        <span class="audio_card_desc weui-flex weui-flex_align-center">
                            <span class="audio_card_desc_meta audio_card_nickname">
                                <span class="weui-hidden_abs">,</span>
                                <span class="audio_card_nickname_inner"></span>
                            </span>
                        </span>
                    </span>
                </span>
                <span class="weui-flex audio_card_desc-time">
                    <span class="weui-flex__item audio_card_desc js_duration js_duration1">
                        <span class="weui-hidden_abs">,</span><span class="text"></span></span>
                    <span class="weui-flex__item audio_card_desc js_duration js_duration2">
                        <span style="position: relative; display: inline-block;">
                            <span style="opacity: 0; display: inline-block;" aria-hidden="true">00:00</span>
                            <span style="position: absolute; left: 0; top: 0;" class="start"></span>
                        </span>
                        <span style="position: relative; display: inline-block;">/</span>
                        <span style="position: relative; display: inline-block;">
                            <span style="opacity: 0; display: inline-block;" aria-hidden="true">00:00</span>
                            <span style="position: absolute; right: 0; top: 0;" class="end"></span>
                        </span>
                    </span>

                    <span class="audio_card_opr">
                        <button aria-label="稍后听" class="weui-btn_icon js_audio_listen_later" style="visibility: hidden;">
                            <i class="weui-icon-filled-listen-later"></i>
                        </button>
                        <button aria-label="Play" class="weui-btn_icon audio_card_switch_btn js_voice_play" title="按住option + 上下方向键可调音量">
                            <i class="weui-icon-filled-play"></i>
                            <i class="weui-icon-filled-pause"></i>
                        </button>
                    </span>
                </span>
            </span>
            <span id="audio_progress_bar" class="js_audio_progress_bar">
                <span id="voice_seekRange" class="audio_card_progress_wrp js_audio_card_progress_wrp">
                    <span class="audio_card_progress">
                        <span id="voice_progress" class="audio_card_progress_inner js_audio_card_progress_inner" style="width: 10%;"></span>
                        <span id="voice_buffer" class="audio_card_progress_buffer js_audio_card_progress_buffer" style="width: 100%;"></span>
                        <span id="voice_loading" class="audio_card_progress_loading js_audio_card_progress_loading" style="display: none;"></span>
                    </span>
                    <span
                            tabindex="0"
                            role="option"
                            title="按住option + 左右方向键可调"
                            id="voice_playdot"
                            class="js_audio_card_progress_handle audio_card_progress_handle weui-wa-hotarea"
                            style="display: block; left: 10%;">
                        <span class="weui-hidden_abs">
                            <span id="voice_percent_desc" class="js_voice_percent_desc">进度条</span>
                            <span id="voice_percent" class="js_voice_percent">10%</span>
                        </span>
                    </span>
                </span>
            </span>
        </span>
        <!---->
        <!---->
    </div>

    <audio style="height:0;width:0;display:none" src=""></audio>
</template>
    `;
  let customElementTemplate = '';
  if (hasMpAudio) {
    customElementTemplate += mpAudioTemplate;
    customElementTemplate += '<script type="text/javascript" src="./assets/mp-common-mpaudio.js"></script>';
    const url = '/custom-elements/mp-common-mpaudio.js?v=2';
    let scriptFile: Blob | null;
    const mpCommonMpAudioJsCache = await getAssetCache(url);
    if (mpCommonMpAudioJsCache) {
      scriptFile = mpCommonMpAudioJsCache.file;
    } else {
      scriptFile = await request<Blob>(url, { retry: 1, retryDelay: 500 });
      await updateAssetCache({ url: url, file: scriptFile, fakeid: fakeid });
    }
    zip.file(`assets/mp-common-mpaudio.js`, scriptFile);
  }

  const indexHTML = `<!DOCTYPE html>
<html lang="zh_CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
    <title>${title}</title>
    ${localLinks}
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
${customElementTemplate}

${pageContentHTML}
${jsArticleBottomBarHTML}

${readNum !== -1 ? '<p class="__page_content__">阅读量 ' + readNum + '</p>' : ''}
<!-- 评论数据 -->
${commentHTML}
</body>
</html>`;

  zip.file('index.html', indexHTML);

  return zip;
}

export function gotoLink(url: string) {
  window.open(url);
}

// 计算最佳并发量
export function bestConcurrencyCount(proxyCount: number): number {
  return proxyCount > 5 ? proxyCount - 3 : Math.max(proxyCount - 2, 1);
}

// 检测用户浏览器是否为 Chrome
export function isChromeBrowser() {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.includes('micromessenger')) {
    // 微信内置浏览器
    return false;
  }

  if (!userAgent.includes('chrome')) {
    // 非 Chromium 内核
    return false;
  }

  if (typeof (navigator as any).brave === 'object') {
    // Brave 浏览器
    return false;
  }

  // catch-all
  return true;
}
