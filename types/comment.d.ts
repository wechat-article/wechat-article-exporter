interface BaseResp {
  exportkey_token: string;
  ret: number;
}

interface IPWording {
  country_id: string;
  country_name: string;
  province_id: string;
  province_name: string;
  city_id: string;
  city_name: string;
}

interface Comment {
  author_like_status: number;
  content: string;
  content_id: string;
  create_time: number;
  id: number;
  identity_name: string;
  identity_type: number;
  ip_wording: IPWording;
  is_can_delete: boolean;
  is_elected: number;
  is_from: number;
  is_from_friend: number;
  is_from_me: number;
  is_top: number;
  like_num: number;
  like_status: number;
  logo_url: string;
  my_id: number;
  nick_name: string;
  openid: string;
  reply_new: {
    max_reply_id: number;
    reply_list: ReplyComment[];
    reply_total_cnt: number;
  };
}

interface ReplyComment {
  author_like_status: number;
  content: string;
  create_time: number;
  identity_name: string;
  identity_type: number;
  ip_wording: IPWording;
  is_deleted: number;
  is_from: number;
  is_from_friend: number;
  logo_url: string;
  nick_name: string;
  openid: string;
  reply_del_flag: number;
  reply_id: number;
  reply_is_elected: number;
  reply_like_num: number;
  reply_like_status: number;
}

export interface CommentResponse {
  base_resp: BaseResp;
  buffer: string;
  continue_flag: boolean;
  elected_comment: Comment[];
  elected_comment_total_cnt: number;
  enabled: number;
  friend_comment: Comment[];
  identity_name: string;
  identity_type: number;
  is_fans: number;
  logo_url: string;
  my_comment: Comment[];
  nick_name: string;
  not_pay_can_comment: number;
  only_fans_can_comment: boolean;
  only_fans_days_can_comment: boolean;
  reply_flag: number;
}

interface ReplyList {
  max_reply_id: number;
  reply_list: ReplyComment[];
}

export interface ReplyResponse {
  base_resp: BaseResp;
  buffer: string;
  reply_list: ReplyList;
}
