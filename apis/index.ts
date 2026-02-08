import { request } from '#shared/utils/request';
import { ACCOUNT_LIST_PAGE_SIZE, ARTICLE_LIST_PAGE_SIZE } from '~/config';
import { updateArticleCache } from '~/store/v2/article';
import { type MpAccount, updateLastUpdateTime } from '~/store/v2/info';
import type { CommentResponse } from '~/types/comment';
import type { ParsedCredential } from '~/types/credential';
import type { ParsedProfileGetMsg, ProfileGetMsgResponse } from '~/types/profile_getmsg';
import type {
  AccountInfo,
  AppMsgEx,
  AppMsgPublishResponse,
  PublishInfo,
  PublishPage,
  SearchBizResponse,
} from '~/types/types';

const loginAccount = useLoginAccount();
const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);

/**
 * 获取文章列表
 * @param account
 * @param begin
 * @param keyword
 * @return [文章列表, 是否加载完毕, 文章总数]
 */
export async function getArticleList(
  account: MpAccount,
  begin = 0,
  keyword = ''
): Promise<[AppMsgEx[], boolean, number]> {
  const resp = await request<AppMsgPublishResponse>('/api/web/mp/appmsgpublish', {
    query: {
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

    // 更新缓存，注意带有关键字搜索的结果不能写入缓存
    if (!keyword) {
      try {
        await updateArticleCache(account, publish_page);

        if (begin === 0) {
          await updateLastUpdateTime(account.fakeid);
        }
      } catch (e) {
        console.error('写入文章缓存失败:', e);
      }
    }

    const articles = publish_list.flatMap(item => {
      const publish_info: PublishInfo = JSON.parse(item.publish_info);
      return publish_info.appmsgex;
    });
    return [articles, isCompleted, publish_page.total_count];
  } else if (resp.base_resp.ret === 200003) {
    loginAccount.value = null;
    throw new Error('session expired');
  } else {
    throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
  }
}

/**
 * 获取公众号列表
 * @param begin
 * @param keyword
 */
export async function getAccountList(begin = 0, keyword = ''): Promise<[AccountInfo[], boolean]> {
  const resp = await request<SearchBizResponse>('/api/web/mp/searchbiz', {
    query: {
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
    loginAccount.value = null;
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
      console.warn('credentials not set');
      return null;
    }
    const response = await request<CommentResponse>('/api/web/misc/comment', {
      query: {
        comment_id: commentId,
        ...credentials,
      },
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

/**
 * 获取公众号文章列表
 * @description 该接口采用微信接口，而非公众号平台接口，因此需要先获取 Credentials
 * @param fakeid
 * @param begin
 */
export async function getArticleListWithCredential(fakeid: string, begin = 0) {
  const targetCredential = credentials.value.find(item => item.biz === fakeid);
  if (!targetCredential) {
    throw new Error('目标公众号的 Credential 未设置');
  }

  const resp = await request<ProfileGetMsgResponse>('/api/web/mp/profile_ext_getmsg', {
    query: {
      id: fakeid,
      begin: begin,
      size: 10,
      uin: targetCredential.uin,
      key: targetCredential.key,
      pass_ticket: targetCredential.pass_ticket,
    },
  });
  if (resp.ret === 0) {
    return JSON.parse(resp.general_msg_list) as ParsedProfileGetMsg[];
  } else {
    throw new Error(`${resp.ret}:${resp.errmsg}`);
  }
}
