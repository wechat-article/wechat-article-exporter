import { getCommentCache } from '~/store/v2/comment';
import { getCommentReplyCache } from '~/store/v2/comment_reply';
import { formatTimeStamp } from '~/utils';
import { getMetadataCache } from '~/store/v2/metadata';

/**
 * 渲染文章的评论内容
 * @param url 文章链接
 */
export async function renderComments(url: string) {
  let commentHTML = '';
  let elected_comments = [];

  const commentCache = await getCommentCache(url);
  if (commentCache) {
    const commentResponse = commentCache.data;
    if (Array.isArray(commentResponse)) {
      elected_comments = commentResponse.flatMap(response => response.elected_comment);
    } else if (commentResponse) {
      elected_comments = commentResponse.elected_comment;
    }

    if (elected_comments.length > 0) {
      // 评论总数
      const metadata = await getMetadataCache(url);
      commentHTML += '<div style="max-width: 667px;margin: 0 auto;padding: 10px 10px 80px;">';
      commentHTML += `<p style="font-size: 15px;color: #949494;">留言 ${metadata?.commentNum}</p>`;
      commentHTML += '<div style="margin-top: -10px;">';

      // 留言列表
      for (const comment of elected_comments) {
        commentHTML += '<div style="margin-top: 25px;"><div style="display: flex;">';
        if ([1, 2].includes(comment.identity_type)) {
          commentHTML += `<img src="${comment.logo_url}" style="display: block;width: 30px;height: 30px;border-radius: 50%;margin-right: 8px;" alt="">`;
        } else {
          commentHTML += `<img src="${comment.logo_url}" style="display: block;width: 30px;height: 30px;border-radius: 2px;margin-right: 8px;" alt="">`;
        }
        commentHTML += '<div style="flex: 1;"><p style="display: flex;line-height: 16px;margin-block: 5px;">';
        commentHTML += `<span style="margin-right: 5px;font-size: 15px;color: #949494;">${comment.nick_name}</span>`;
        if (comment.is_from_friend === 1) {
          commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #00BA5A;">朋友</span>`;
        }
        if (comment.ip_wording) {
          commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #b5b5b5;">${comment.ip_wording?.province_name}</span>`;
        } else {
          commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #00BA5A;">作者</span>`;
        }
        commentHTML += `<span style="font-size: 12px;color: #b5b5b5;">${formatTimeStamp(comment.create_time)}</span>`;
        commentHTML += '<span style="flex: 1;"></span><span style="display: inline-flex;align-items: center;">';
        commentHTML += `<span class="sns_opr_btn sns_praise_btn" style="font-size: 12px;color: #8b8a8a;">${comment.like_num || ''}</span>`;
        commentHTML += '</span></p>';
        commentHTML += `<p style="font-size: 15px;color: #333;white-space: pre-line;margin-block: .5em;">${comment.content}</p>`;
        if (comment.multi_info && comment.multi_info.pictures && comment.multi_info.pictures.length > 0) {
          commentHTML += `<p>${comment.multi_info.pictures.map((pic: any) => '<img src="' + pic.url + '" style="max-width: 100%;" alt="">').join('')}</p>`;
        }
        if (comment.author_like_status === 1) {
          commentHTML += '<p style="font-size: 12px;color: #00BA5A;margin-block: .5em;">作者赞过</p>';
        }
        commentHTML += '</div></div>';

        // 留言回复列表
        let reply_list = [];
        const commentReplyResponse = await getCommentReplyCache(url, comment.content_id);
        if (
          commentReplyResponse &&
          commentReplyResponse.data &&
          commentReplyResponse.data.reply_list.reply_list.length > 0
        ) {
          reply_list = commentReplyResponse.data.reply_list.reply_list;
        } else if (comment.reply_new && comment.reply_new.reply_list.length > 0) {
          reply_list = comment.reply_new.reply_list;
        }
        commentHTML += '<div style="padding-left: 38px;">';
        reply_list
          .sort((a: any, b: any) => a.create_time - b.create_time)
          .forEach((reply: any) => {
            commentHTML += '<div style="display: flex;margin-top: 15px;">';
            if ([1, 2].includes(reply.identity_type)) {
              commentHTML += `<img src="${reply.logo_url}" style="display: block;width: 23px;height: 23px;border-radius: 50%;margin-right: 8px;" alt="">`;
            } else {
              commentHTML += `<img src="${reply.logo_url}" style="display: block;width: 23px;height: 23px;border-radius: 2px;margin-right: 8px;" alt="">`;
            }
            commentHTML += '<div style="flex: 1;"><p style="display: flex;line-height: 16px;margin-block: 5px;">';
            commentHTML += `<span style="margin-right: 5px;font-size: 15px;color: #949494;">${reply.nick_name}</span>`;

            if (reply.is_from_friend === 1) {
              commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #00BA5A;">朋友</span>`;
            }
            if (reply.ip_wording) {
              commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #b5b5b5;">${reply.ip_wording?.province_name}</span>`;
            } else {
              commentHTML += `<span style="margin-right: 5px;font-size: 12px;color: #00BA5A;">作者</span>`;
            }
            commentHTML += `<span style="font-size: 12px;color: #b5b5b5;">${formatTimeStamp(reply.create_time)}</span>`;
            commentHTML +=
              '<span style="flex: 1;"></span><span style="display: inline-flex;align-items: center; font-size: 12px;color: #b5b5b5;">';
            commentHTML += `<span class="sns_opr_btn sns_praise_btn" style="font-size: 12px;color: #8b8a8a;">${reply.reply_like_num || ''}</span>`;
            commentHTML += '</span></p>';
            commentHTML += `<p style="font-size: 15px;color: #333;white-space: pre-line;margin-block: .5em;">${reply.to_nick_name ? '回复 ' + reply.to_nick_name + ':' : ''} ${reply.content}</p>`;
            if (reply.multi_info && reply.multi_info.pictures && reply.multi_info.pictures.length > 0) {
              commentHTML += `<p>${reply.multi_info.pictures.map((pic: any) => '<img src="' + pic.url + '" style="max-width: 100%;" alt="">').join('')}</p>`;
            }
            if (reply.author_like_status === 1) {
              commentHTML += '<p style="font-size: 12px;color: #00BA5A;margin-block: .5em;">作者赞过</p>';
            }
            commentHTML += '</div></div>';
          });
        commentHTML += '</div>';

        commentHTML += '</div>';
      }

      commentHTML += '</div></div>';
    }
  }

  return commentHTML;
}

// 获取文章的评论数据
export async function getArticleComments(url: string) {
  let elected_comments = [];
  const commentCache = await getCommentCache(url);
  if (commentCache) {
    const commentResponse = commentCache.data;
    if (Array.isArray(commentResponse)) {
      elected_comments = commentResponse.flatMap(response => response.elected_comment);
    } else if (commentResponse) {
      elected_comments = commentResponse.elected_comment;
    }

    if (elected_comments.length > 0) {
      for (const comment of elected_comments) {
        // 留言回复列表
        let reply_list = [];
        const commentReplyResponse = await getCommentReplyCache(url, comment.content_id);
        if (
          commentReplyResponse &&
          commentReplyResponse.data &&
          commentReplyResponse.data.reply_list.reply_list.length > 0
        ) {
          reply_list = commentReplyResponse.data.reply_list.reply_list;
        } else if (comment.reply_new && comment.reply_new.reply_list.length > 0) {
          reply_list = comment.reply_new.reply_list;
        }
        reply_list.sort((a: any, b: any) => a.create_time - b.create_time);
        comment.$reply_list = reply_list;
      }
    }
  }

  return elected_comments;
}
