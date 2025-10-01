import type { RGB } from '~/types/types';

interface BaseResp {
  exportkey_token: string;
  ret: number;
}
type BooleanString = '0' | '1';

export interface BaseInfo {
  article_count: string;
  brand_icon: string;
  cover: string;
  cover_ban: BooleanString;
  description: string;
  fee: string;
  is_first_screen: BooleanString;
  is_numbered: BooleanString;
  is_paid: BooleanString;
  is_reverse: BooleanString;
  isupdating: BooleanString;
  needpay: BooleanString;
  nickname: string;
  public_tag_content_num: string;
  public_tag_link: string;
  share_brand_icon: string;
  subtype: string;
  title: string;
  type: string;
  update_frequence: Record<string, string>;
  username: string;
}

export interface ArticleItem {
  cover_img_1_1: string;
  cover_theme_color?: RGB;
  create_time: string;
  is_pay_subscribe: BooleanString;
  is_read: BooleanString;
  item_show_type: string;
  itemidx: string;
  key: string;
  msgid: string;
  pos_num?: string;
  title: string;
  tts_is_ban: string;
  url: string;
  user_read_status: string;
}

export interface GetAlbumResp {
  article_list: ArticleItem[] | ArticleItem;
  base_info: BaseInfo;
  continue_flag: BooleanString;
  is_pay_subscribe: BooleanString;
  reverse_continue_flag: BooleanString;
}

export interface AppMsgAlbumResult {
  base_resp: BaseResp;
  getalbum_resp: GetAlbumResp;
}
