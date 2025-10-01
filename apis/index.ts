import type {
  AccountInfo,
  AppMsgEx,
  AppMsgPublishResponse,
  PostSwitchAccResponse,
  PublishInfo,
  PublishPage,
  SearchBizResponse,
  ServiceBizListItem,
  SwitchAccResponse,
} from '~/types/types';
import { ACCOUNT_LIST_PAGE_SIZE, ARTICLE_LIST_PAGE_SIZE } from '~/config';
import { updateAPICache } from '~/store/v2/api';
import { updateArticleCache } from '~/store/v2/article';
import type { CommentResponse } from '~/types/comment';
import { type Info, updateLastUpdateTime } from '~/store/v2/info';
import type { ParsedCredential } from '~/types/credential';

interface AuthorInfoResponse {
  base_resp: { ret: number };
  identity_name: string;
  is_verify: number;
  original_article_count: number;
}

const loginAccount = useLoginAccount();

/**
 * 获取公众号主体信息
 * @param biz
 */
export async function authorInfo(biz: string) {
  return await $fetch<AuthorInfoResponse>('/api/web/misc/authorinfo', {
    method: 'GET',
    query: {
      biz: biz,
    },
  });
}

/**
 * 获取文章列表
 * @param account
 * @param token
 * @param begin
 * @param keyword
 */
export async function getArticleList(
  account: Info,
  token: string,
  begin = 0,
  keyword = ''
): Promise<[AppMsgEx[], boolean, number]> {
  const resp = await $fetch<AppMsgPublishResponse>('/api/web/mp/appmsgpublish', {
    method: 'GET',
    query: {
      id: account.fakeid,
      token: token,
      begin: begin,
      size: ARTICLE_LIST_PAGE_SIZE,
      keyword: keyword,
    },
    retry: 0,
  });

  // 记录 api 调用
  await updateAPICache({
    name: 'appmsgpublish',
    account: loginAccount.value?.nickname,
    call_time: new Date().getTime(),
    is_normal: resp.base_resp.ret === 0 || resp.base_resp.ret === 200003,
    payload: {
      id: account.fakeid,
      begin: begin,
      size: ARTICLE_LIST_PAGE_SIZE,
      keyword: keyword,
    },
  });

  if (resp.base_resp.ret === 0) {
    const publish_page: PublishPage = JSON.parse(resp.publish_page);
    const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);

    // 返回的文章数量为0就表示已加载完毕
    const isCompleted = publish_list.length === 0;

    // 更新缓存，注意搜索的结果不能写入缓存
    if (!keyword) {
      try {
        await updateArticleCache(account, publish_page);
      } catch (e) {
        console.info('缓存失败');
        console.error(e);
      }
    }

    if (begin === 0) {
      await updateLastUpdateTime(account.fakeid);
    }

    const articles = publish_list.flatMap(item => {
      const publish_info: PublishInfo = JSON.parse(item.publish_info);
      return publish_info.appmsgex;
    });
    return [articles, isCompleted, publish_page.total_count];
  } else if (resp.base_resp.ret === 200003) {
    throw new Error('session expired');
  } else {
    throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
  }
}

/**
 * 获取公众号列表
 * @param token
 * @param begin
 * @param keyword
 */
export async function getAccountList(token: string, begin = 0, keyword = ''): Promise<[AccountInfo[], boolean]> {
  const resp = await $fetch<SearchBizResponse>('/api/web/mp/searchbiz', {
    method: 'GET',
    query: {
      keyword: keyword,
      begin: begin,
      size: ACCOUNT_LIST_PAGE_SIZE,
      token: token,
    },
    retry: 0,
  });

  // 记录 api 调用
  await updateAPICache({
    name: 'searchbiz',
    account: loginAccount.value?.nickname,
    call_time: new Date().getTime(),
    is_normal: resp.base_resp.ret === 0 || resp.base_resp.ret === 200003,
    payload: {
      begin: begin,
      size: ACCOUNT_LIST_PAGE_SIZE,
      keyword: keyword,
    },
  });

  if (resp.base_resp.ret === 0) {
    // 公众号判断是否结束的逻辑与文章不太一样
    // 当第一页的结果就少于5个则结束，否则只有当搜索结果为空才表示结束
    const isCompleted = begin === 0 ? resp.total < ACCOUNT_LIST_PAGE_SIZE : resp.total === 0;

    return [resp.list, isCompleted];
  } else if (resp.base_resp.ret === 200003) {
    throw new Error('session expired');
  } else {
    throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
  }
}

/**
 * 获取评论
 * @param commentId
 */
export async function getComment(commentId: string) {
  try {
    // 本地设置的 credentials
    const credentials = JSON.parse(window.localStorage.getItem('credentials')!);
    if (!credentials || !credentials.__biz || !credentials.pass_ticket || !credentials.key || !credentials.uin) {
      console.log('credentials not set');
      return null;
    }
    const response = await $fetch<CommentResponse>('/api/web/misc/comment', {
      method: 'get',
      query: {
        comment_id: commentId,
        ...credentials,
      },
      retry: 0,
    });
    if (response.base_resp.ret === 0) {
      return response;
    } else {
      return null;
    }
  } catch (e) {
    console.warn('credentials parse error', e);
    return null;
  }
}

const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);

/**
 * 根据 credentials 获取文章列表
 */
export async function getArticleListByCredential() {
  if (credentials.value.filter(c => c.valid).length === 0) {
    console.warn('credentials not set');
    return;
  }

  const credential = credentials.value[0];
  const url = `https://mp.weixin.qq.com/mp/profile_ext?action=getmsg&f=json&count=10&is_ok=1&__biz=${credential.biz}&key=${credential.key}&uin=${credential.uin}&pass_ticket=${credential.pass_ticket}&offset=0`;
  try {
    const resp: any = await fetch('https://00.workers-proxy.shop?url=' + encodeURIComponent(url), {
      referrerPolicy: 'unsafe-url',
      headers: {},
    }).then(resp => resp.json());
    const general_msg_list = JSON.parse(resp.general_msg_list);
    console.log(general_msg_list);
  } catch (e) {
    console.warn(e);
  }
}

/**
 * 获取免扫码切换的账户列表
 * @param token
 */
export async function getSwitchAccountList(token: string): Promise<ServiceBizListItem[]> {
  const resp = await $fetch<SwitchAccResponse>('/api/web/mp/switchacc', {
    method: 'GET',
    query: {
      token: token,
    },
    retry: 0,
  });

  // 记录 api 调用
  await updateAPICache({
    name: 'switchacc',
    account: loginAccount.value?.nickname,
    call_time: new Date().getTime(),
    is_normal: resp.base_resp.ret === 0 || resp.base_resp.ret === 200003,
    payload: {},
  });

  if (resp.base_resp.ret === 0) {
    return [
      ...resp.service_biz_list.list.map(item => ({ ...item, order_type: resp.service_biz_list.order_type })),
      ...resp.biz_list.list.map(item => ({ ...item, order_type: resp.biz_list.order_type })),
    ];
  } else if (resp.base_resp.ret === 200003) {
    throw new Error('session expired');
  } else {
    throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
  }
}

export async function switchAccountApi(token: string, username: string) {
  const resp = await $fetch<PostSwitchAccResponse>('/api/web/mp/switchacc', {
    method: 'POST',
    params: {
      token: token,
      username: username,
    },
    retry: 0,
  });

  // 记录 api 调用
  await updateAPICache({
    name: 'switchacc',
    account: loginAccount.value?.nickname,
    call_time: new Date().getTime(),
    is_normal: resp.base_resp.ret === 0 || resp.base_resp.ret === 200003,
    payload: {},
  });

  if (resp.base_resp.ret === 0) {
    return resp.data;
  } else if (resp.base_resp.ret === 200003) {
    throw new Error('session expired');
  } else {
    throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
  }
}
