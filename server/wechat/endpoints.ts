/**
 * 微信公众平台相关 URL 集中定义，便于变更与审计。
 */
export const MP_ORIGIN = 'https://mp.weixin.qq.com';

export const MP_ENDPOINTS = {
  searchbiz: `${MP_ORIGIN}/cgi-bin/searchbiz`,
  profileExt: `${MP_ORIGIN}/mp/profile_ext`,
  scanLoginQrcode: `${MP_ORIGIN}/cgi-bin/scanloginqrcode`,
  bizlogin: `${MP_ORIGIN}/cgi-bin/bizlogin`,
  appmsgpublish: `${MP_ORIGIN}/cgi-bin/appmsgpublish`,
  info: `${MP_ORIGIN}/cgi-bin/info`,
  home: `${MP_ORIGIN}/cgi-bin/home`,
  logout: `${MP_ORIGIN}/cgi-bin/logout`,
  searchByUrl: `${MP_ORIGIN}/cgi-bin/searchbyurl`,
  authorInfo: `${MP_ORIGIN}/mp/authorinfo`,
  appmsgComment: `${MP_ORIGIN}/mp/appmsg_comment`,
  appmsgAlbum: `${MP_ORIGIN}/mp/appmsgalbum`,
} as const;
