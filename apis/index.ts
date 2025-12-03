import { useLocalStorage } from '@vueuse/core';
import { ACCOUNT_LIST_PAGE_SIZE, ARTICLE_LIST_PAGE_SIZE } from '~/config';
import { updateAPICache } from '~/store/v2/api';
import { updateArticleCache } from '~/store/v2/article';
import { markAccountHidden, markAccountVisible, markCompleted, updateLastUpdateTime, type Info } from '~/store/v2/info';
import type { CommentResponse } from '~/types/comment';
import type { ParsedCredential } from '~/types/credential';
import type {
  AccountInfo,
  AppMsgEx,
  AppMsgPublishResponse,
  PublishInfo,
  PublishListItem,
  PublishPage,
  SearchBizResponse,
} from '~/types/types';

const loginAccount = useLoginAccount();
const credentials = useLocalStorage<ParsedCredential[]>('auto-detect-credentials:credentials', []);
// 记录 profile_ext 分页时的 next_offset，避免重复
const profileExtNextOffset = new Map<string, number>();
// 记录 profile_ext 已累积条数
const profileExtLoadedCount = new Map<string, number>();

interface ProfileExtResponse {
  base_resp?: {
    ret: number;
    err_msg?: string;
  };
  ret?: number;
  errmsg?: string;
  general_msg_list?: string | ProfileExtList;
  next_offset?: number;
  can_msg_continue?: number;
  msg_count?: number;
}

interface ProfileExtList {
  list: ProfileExtItem[];
  msg_count?: number;
}

interface ProfileExtItem {
  comm_msg_info?: {
    id?: number;
    datetime?: number;
    content?: string;
  };
  app_msg_ext_info?: ProfileExtSubItem;
}

interface ProfileExtSubItem {
  title?: string;
  digest?: string;
  content_url?: string;
  source_url?: string;
  cover?: string;
  is_multi?: number;
  multi_app_msg_item_list?: ProfileExtSubItem[];
  author?: string;
  copyright_stat?: number;
  copyright_type?: number;
}

/**
 * 获取文章列表
 * @param account
 * @param begin
 * @param keyword
 */
export async function getArticleList(account: Info, begin = 0, keyword = ''): Promise<[AppMsgEx[], boolean, number]> {
  // 如果公众号禁止搜索
  if (account.hidden) {
    const [articles, isCompleted, total] = await getArticleListViaCredential(account, begin);

    await updateAPICache({
      name: 'appmsgpublish',
      account: loginAccount.value?.nickname,
      call_time: new Date().getTime(),
      is_normal: true,
      payload: {
        id: account.fakeid,
        begin: begin,
        size: ARTICLE_LIST_PAGE_SIZE,
        keyword: keyword,
        hidden: true,
      },
    });

    if (begin === 0) {
      await updateLastUpdateTime(account.fakeid);
    }

    return [articles, isCompleted, total];
  }

  const resp = await $fetch<AppMsgPublishResponse>('/api/web/mp/appmsgpublish', {
    method: 'GET',
    query: {
      id: account.fakeid,
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
    // 正常获取到文章列表
    const publish_page: PublishPage = JSON.parse(resp.publish_page);
    const publish_list = publish_page.publish_list.filter(item => !!item.publish_info);
    // 标记为可搜索
    if (begin === 0) {
      // 首次正常拉取即认为账号可被搜索，写回 info
      await markAccountVisible(account.fakeid);
      account.hidden = false;
    }

    // 返回的文章数量为0就表示已加载完毕
    const isCompleted = publish_list.length === 0;

    // 更新缓存，注意搜索的结果不能写入缓存
    if (!keyword) {
      try {
        await updateArticleCache({ ...account, hidden: false }, publish_page);
      } catch (e) {
        console.warn('缓存失败');
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
    // 微信公众号登录信息已经失效
    loginAccount.value = null;
    throw new Error('session expired');
  } else if (resp.base_resp.ret === 200002) {
    // 公众号已禁止通过名称搜索到本账号，抛出异常等待处理
    await markAccountHidden(account.fakeid);
    throw new Error('公众号已设置禁止搜索，改为带登录信息方式加载公众号列表');
  } else {
    // 其他未知错误
    throw new Error(`${resp.base_resp.ret}:${resp.base_resp.err_msg}`);
  }
}

/**
 * 带登录信息的方式加载文章列表
 * @param account
 * @param begin
 * @returns
 */
async function getArticleListViaCredential(account: Info, begin = 0): Promise<[AppMsgEx[], boolean, number]> {
  const credential = credentials.value.find(item => item.biz === account.fakeid && item.valid);
  if (!credential) {
    throw new Error('目标公众号的 Credential 未设置');
  }

  // 首次加载重置计数
  if (begin === 0) {
    profileExtLoadedCount.set(account.fakeid, 0);
    profileExtNextOffset.delete(account.fakeid);
  }

  const offsetParam = begin === 0 ? 0 : (profileExtNextOffset.get(account.fakeid) ?? begin);

  const resp = await $fetch<ProfileExtResponse>('/api/web/mp/profile_ext', {
    method: 'GET',
    query: {
      action: 'getmsg',
      f: 'json',
      is_ok: 1,
      __biz: credential.biz,
      pass_ticket: credential.pass_ticket,
      key: credential.key,
      uin: credential.uin,
      offset: offsetParam,
      count: 10,
    },
    retry: 0,
  });

  ensureProfileExtSuccess(resp);

  const listJson = parseGeneralMsgList(resp.general_msg_list);
  const list: ProfileExtItem[] = listJson?.list || [];

  const articles: AppMsgEx[] = [];
  const publish_list: PublishListItem[] = [];

  for (const msg of list) {
    const itemArticles: AppMsgEx[] = [];
    const createTime = msg.comm_msg_info?.datetime || 0;
    const msgId = msg.comm_msg_info?.id || Date.now();
    const ext = msg.app_msg_ext_info;
    if (ext) {
      const mainArticle = buildArticleFromProfileExt(ext, msgId, 1, createTime, account);
      itemArticles.push(mainArticle);
      articles.push(mainArticle);

      if (ext.multi_app_msg_item_list && ext.multi_app_msg_item_list.length > 0) {
        ext.multi_app_msg_item_list.forEach((sub, idx) => {
          const article = buildArticleFromProfileExt(sub, msgId, idx + 2, createTime, account);
          itemArticles.push(article);
          articles.push(article);
        });
      }
    } else {
      // 无 app_msg_ext_info（如纯文本消息）也占位，确保分页步长与 offset 对齐
      const stub = buildStubArticle(msg, msgId, createTime);
      itemArticles.push(stub);
      articles.push(stub);
    }

    publish_list.push({
      publish_type: 1,
      publish_info: JSON.stringify({
        appmsgex: itemArticles,
      } as Partial<PublishInfo>),
    });
  }

  const loadedCount = profileExtLoadedCount.get(account.fakeid) ?? 0;
  const totalCount = loadedCount + publish_list.length;

  const publish_page: PublishPage = {
    featured_count: 0,
    masssend_count: publish_list.length,
    publish_count: publish_list.length,
    publish_list,
    total_count: totalCount,
  };

  if (articles.length > 0) {
    try {
      await updateArticleCache(account, publish_page);
    } catch (e) {
      console.warn('缓存隐藏账号文章失败');
      console.error(e);
    }
  }

  const isCompleted = (resp.can_msg_continue ?? 0) === 0 || list.length === 0;

  // 记录下一次 offset，优先用接口返回，否则累加
  const nextOffset = resp.next_offset ?? offsetParam + publish_list.length;
  profileExtNextOffset.set(account.fakeid, nextOffset);
  profileExtLoadedCount.set(account.fakeid, totalCount);
  if (isCompleted) {
    await markCompleted(account.fakeid);
  }

  // 调试输出：打印本批文章编号/标题/url
  if (process.client) {
    const debugList = articles.map((a, idx) => `${begin + idx + 1}: ${a.title} => ${a.link}`);
    console.log(
      `[profile_ext] ${account.nickname || account.fakeid} offset=${offsetParam} next_offset=${nextOffset} count=${articles.length}`,
      debugList
    );
  }

  return [articles, isCompleted, publish_page.total_count];
}

function ensureProfileExtSuccess(resp: ProfileExtResponse) {
  const retCode = resp.base_resp?.ret ?? resp.ret ?? -1;
  if (retCode !== 0) {
    const msg = resp.base_resp?.err_msg || resp.errmsg || '获取文章列表失败';
    throw new Error(`${retCode}:${msg}`);
  }
}

function parseGeneralMsgList(general_msg_list?: string | ProfileExtList): ProfileExtList {
  if (!general_msg_list) {
    return { list: [], msg_count: 0 };
  }
  if (typeof general_msg_list !== 'string') {
    return general_msg_list;
  }
  try {
    return JSON.parse(general_msg_list);
  } catch (e) {
    console.error('解析 general_msg_list 失败', e);
    return { list: [], msg_count: 0 };
  }
}

function buildStubArticle(msg: ProfileExtItem, msgId: number, createTime: number): AppMsgEx {
  return {
    aid: `${msgId}_1`,
    album_id: '',
    appmsg_album_infos: [],
    appmsgid: msgId,
    author_name: '',
    ban_flag: 0,
    checking: 0,
    copyright_stat: 0,
    copyright_type: 0,
    cover: '',
    cover_img: '',
    cover_img_theme_color: undefined,
    create_time: createTime,
    digest: msg.comm_msg_info?.content || '',
    has_red_packet_cover: 0,
    is_deleted: false,
    is_pay_subscribe: 0,
    item_show_type: 0,
    itemidx: 1,
    link: '',
    media_duration: '',
    mediaapi_publish_status: 0,
    pic_cdn_url_1_1: '',
    pic_cdn_url_3_4: '',
    pic_cdn_url_16_9: '',
    pic_cdn_url_235_1: '',
    title: msg.comm_msg_info?.content || '公众号消息',
    update_time: createTime,
  };
}

function buildArticleFromProfileExt(
  item: ProfileExtSubItem,
  msgId: number,
  itemidx: number,
  createTime: number,
  account: Info
): AppMsgEx {
  const link = item.content_url?.replace(/&amp;/g, '&') || '';
  const cover = item.cover || '';
  const author = item.author || account.nickname || '';
  let copyrightStat: number = item.copyright_stat ?? 0;
  let copyrightType: number = item.copyright_type ?? 0;

  // profile_ext 返回中无版权字段时，默认按原创处理（source_url 为空且作者来自当前账号）
  if (item.copyright_stat === undefined && item.copyright_type === undefined) {
    const isReprint = Boolean(item.source_url);
    copyrightStat = isReprint ? 0 : 1;
    copyrightType = isReprint ? 0 : 1;
  }

  // 某些返回值使用 100 表示未知，兼容为非原创
  if (copyrightStat === 100 && item.copyright_type === undefined) {
    copyrightStat = 0;
    copyrightType = 0;
  }

  const itemShowType = (item as any).item_show_type ?? (item as any).show_type ?? 0;
  const isPaySubscribe = (item as any).is_pay_subscribe ?? 0;
  const hasRedPacketCover = (item as any).has_red_packet_cover ?? 0;
  return {
    aid: `${msgId}_${itemidx}`,
    album_id: '',
    appmsg_album_infos: [],
    appmsgid: msgId,
    author_name: author,
    ban_flag: 0,
    checking: 0,
    copyright_stat: copyrightStat,
    copyright_type: copyrightType,
    cover: cover,
    cover_img: cover,
    cover_img_theme_color: undefined,
    create_time: createTime,
    digest: item.digest || '',
    has_red_packet_cover: hasRedPacketCover,
    is_deleted: false,
    is_pay_subscribe: isPaySubscribe,
    item_show_type: itemShowType,
    itemidx: itemidx,
    link: link,
    media_duration: '',
    mediaapi_publish_status: 0,
    pic_cdn_url_1_1: cover,
    pic_cdn_url_3_4: cover,
    pic_cdn_url_16_9: cover,
    pic_cdn_url_235_1: cover,
    title: item.title || '',
    update_time: createTime,
  };
}

/**
 * 获取公众号列表
 * @param begin
 * @param keyword
 */
export async function getAccountList(begin = 0, keyword = ''): Promise<[AccountInfo[], boolean]> {
  const resp = await $fetch<SearchBizResponse>('/api/web/mp/searchbiz', {
    method: 'GET',
    query: {
      begin: begin,
      size: ACCOUNT_LIST_PAGE_SIZE,
      keyword: keyword,
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
