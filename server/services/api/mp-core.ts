export interface SearchBizParamsInput {
  begin?: number;
  keyword: string;
  size?: number;
  token: string;
}

export interface AppMsgPublishParamsInput {
  begin?: number;
  fakeid: string;
  keyword?: string;
  size?: number;
  token: string;
}

interface PublishPageLike {
  publish_list?: Array<{ publish_info?: string | null }>;
}

interface PublishResponseLike {
  publish_page: string;
}

export function buildSearchBizParams(input: SearchBizParamsInput): Record<string, string | number> {
  return {
    action: 'search_biz',
    begin: input.begin || 0,
    count: input.size || 5,
    query: input.keyword,
    token: input.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: '1',
  };
}

export function buildAppMsgPublishParams(input: AppMsgPublishParamsInput): Record<string, string | number> {
  const keyword = input.keyword || '';
  const isSearching = keyword.length > 0;

  return {
    sub: isSearching ? 'search' : 'list',
    search_field: isSearching ? '7' : 'null',
    begin: input.begin || 0,
    count: input.size || 5,
    query: keyword,
    fakeid: input.fakeid,
    type: '101_1',
    free_publish_type: 1,
    sub_action: 'list_ex',
    token: input.token,
    lang: 'zh_CN',
    f: 'json',
    ajax: 1,
  };
}

export function extractPublishedArticles(response: PublishResponseLike): any[] {
  const publishPage = JSON.parse(response.publish_page) as PublishPageLike;
  const publishList = Array.isArray(publishPage.publish_list) ? publishPage.publish_list : [];

  return publishList
    .filter(item => !!item.publish_info)
    .flatMap(item => {
      const publishInfo = JSON.parse(item.publish_info as string);
      return publishInfo.appmsgex;
    });
}

export function filterSearchBizResponseByNickname(originalResponse: any, nickname: string): any {
  const response = JSON.parse(JSON.stringify(originalResponse));
  response.list = Array.isArray(response.list) ? response.list.filter((item: any) => item.nickname === nickname) : [];
  response.total = response.list.length;

  if (response.list.length === 0) {
    response.base_resp.ret = -1;
    response.base_resp.err_msg = '根据解析的名称搜索公众号失败';
    response.resolved_name = nickname;
    response.original_resp = originalResponse;
  }

  return response;
}
