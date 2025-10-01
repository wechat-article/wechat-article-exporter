import { proxyMpRequest } from '~/server/utils/proxy-request';
import { getTokenFromStore } from '~/server/utils/CookieStore';

interface AppMsgPublishQuery {
  fakeid: string;
  begin?: number;
  size?: number;
  keyword?: string;
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

  const query = getQuery<AppMsgPublishQuery>(event);
  if (!query.fakeid) {
    return {
      base_resp: {
        ret: -1,
        err_msg: 'fakeid不能为空',
      },
    };
  }
  const fakeid = query.fakeid;
  const keyword = query.keyword || '';
  const begin: number = query.begin || 0;
  const size: number = query.size || 5;

  const isSearching = !!keyword;

  const params: Record<string, string | number> = {
    sub: isSearching ? 'search' : 'list',
    search_field: isSearching ? '7' : 'null',
    begin: begin,
    count: size,
    query: keyword,
    fakeid: fakeid,
    type: '101_1',
    free_publish_type: 1,
    sub_action: 'list_ex',
    token: token,
    lang: 'zh_CN',
    f: 'json',
    ajax: 1,
  };

  const resp = await proxyMpRequest({
    event: event,
    method: 'GET',
    endpoint: 'https://mp.weixin.qq.com/cgi-bin/appmsgpublish',
    query: params,
    parseJson: true,
  }).catch(e => {
    return {
      base_resp: {
        ret: -1,
        err_msg: '获取文章列表接口失败，请重试',
      },
    };
  });

  if (resp.base_resp.ret === 0) {
    const publish_page = JSON.parse(resp.publish_page);
    const articles = publish_page.publish_list
      .filter((item: any) => !!item.publish_info)
      .flatMap((item: any) => {
        const publish_info = JSON.parse(item.publish_info);
        return publish_info.appmsgex;
      });
    return {
      base_resp: resp.base_resp,
      articles: articles,
    };
  }
  return resp;
});
