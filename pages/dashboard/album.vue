<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">合集下载</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部筛选与操作区 -->
      <header class="flex flex-col items-start xl:flex-row xl:items-center gap-2 xl:justify-between px-3 py-2">
        <div class="flex gap-2">
          <div class="flex items-center space-x-3">
            <AccountSelectorForAlbum v-model="selectedAccount" class="w-80" />
            <USelectMenu
              class="w-60"
              color="gray"
              v-model="selectedAlbum"
              :options="selectedAccount?.albums || []"
              option-attribute="title"
              size="md"
              placeholder="选择合集"
            />
            <div>
              <Loader v-if="switchSortLoading" :size="24" class="animate-spin text-slate-500" />
              <div v-else class="flex space-x-2 w-fit" @click="toggleReverse">
                <ArrowUpNarrowWide v-if="isReverse" />
                <ArrowDownNarrowWide v-else />
                <span>{{ isReverse ? '正序' : '倒序' }}</span>
              </div>
            </div>
            <UButton
              color="black"
              variant="solid"
              class="disabled:bg-slate-4 disabled:text-slate-12"
              :loading="fetchAllArticlesBtnLoading"
              :disabled="!selectedAccount || !selectedAlbum || albumArticles.length === 0 || noMoreData"
              @click="fetchAllArticles"
              >抓取全部文章链接</UButton
            >
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <UButton
            color="blue"
            variant="link"
            size="md"
            :disabled="!selectedAccount || !selectedAlbum"
            @click="gotoLink(originalAlbumURL)"
            >跳转到原始链接</UButton
          >
          <UButton
            color="black"
            variant="solid"
            size="md"
            class="disabled:bg-slate-4 disabled:text-slate-12"
            :disabled="!selectedAccount || !selectedAlbum || albumArticles.length === 0 || batchDownloadLoading"
            @click="doBatchDownload"
          >
            <Loader v-if="batchDownloadLoading" :size="20" class="animate-spin" />
            <span v-if="batchDownloadLoading"
              >{{ batchDownloadPhase }}:
              <span v-if="batchDownloadPhase === '下载文章内容'"
                >{{ batchDownloadedCount }}/{{ selectedArticleCount }}</span
              >
              <span v-if="batchDownloadPhase === '打包'">{{ batchPackedCount }}/{{ batchDownloadedCount }}</span>
            </span>
            <span v-else>批量下载</span>
          </UButton>
        </div>
      </header>

      <!-- 合集文章列表 -->
      <main class="flex-1 overflow-y-scroll bg-[#ededed]" v-if="selectedAccount && selectedAlbum">
        <div v-if="albumLoading" class="flex justify-center items-center mt-5">
          <Loader :size="28" class="animate-spin text-slate-500" />
        </div>
        <div v-else-if="albumBaseInfo" class="relative max-w-2xl mx-auto bg-white">
          <!-- banner -->
          <div class="px-5 py-7 banner">
            <h2 class="text-2xl text-white font-bold"># {{ albumBaseInfo.title }}</h2>
          </div>
          <div class="sticky top-0 px-5 py-3 bg-white border-b">
            <p class="flex items-center space-x-2 mb-2">
              <img class="size-5" :src="IMAGE_PROXY + albumBaseInfo.brand_icon" alt="" />
              <span>{{ albumBaseInfo.nickname }}</span>
            </p>
            <p class="text-sm text-slate-10">
              <span>{{ albumBaseInfo.article_count }}篇内容</span>
              <span v-if="albumBaseInfo.description"> · {{ albumBaseInfo.description }}</span>
            </p>
          </div>
          <div class="bg-white px-4 pb-6">
            <!-- 文章列表 -->
            <ul class="divide-y">
              <li
                class="flex justify-between items-center py-5 px-1"
                v-for="article in albumArticles"
                :key="article.key"
              >
                <div class="flex-1">
                  <h3 class="text-lg mb-2">
                    <span v-if="article.pos_num">{{ article.pos_num }}. </span>
                    <span>{{ article.title }}</span>
                  </h3>
                  <time class="text-sm text-slate-10">{{ formatAlbumTime(+article.create_time) }}</time>
                </div>
                <img class="size-16 ml-4 flex-shrink-0" :src="IMAGE_PROXY + article.cover_img_1_1" alt="" />
              </li>
            </ul>

            <!-- 底部加载条 -->
            <div v-element-visibility="onElementVisibility"></div>
            <p v-if="articleLoading" class="flex justify-center items-center mt-2 py-2">
              <Loader :size="28" class="animate-spin text-slate-500" />
            </p>
            <p v-else-if="noMoreData" class="text-center mt-2 py-2 text-slate-400">已全部加载完毕</p>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type Info } from '~/store/v2/info';
import type { AppMsgAlbumInfo, DownloadableArticle } from '~/types/types';
import { ArrowDownNarrowWide, ArrowUpNarrowWide, Loader } from 'lucide-vue-next';
import type { AppMsgAlbumResult, ArticleItem, BaseInfo } from '~/types/album';
import { vElementVisibility } from '@vueuse/components';
import { useDownloadAlbum } from '~/composables/useBatchDownload';
import { formatAlbumTime } from '~/utils/album';
import { gotoLink, sleep } from '~/utils';
import AccountSelectorForAlbum from '~/components/selector/AccountSelectorForAlbum.vue';
import { IMAGE_PROXY, websiteName } from '~/config';

useHead({
  title: `合集下载 | ${websiteName}`,
});

interface AccountInfo extends Info {
  albums?: AppMsgAlbumInfo[];
}

// 已选择的公众号
const selectedAccount = ref<AccountInfo | undefined>();
const downloadFileName = computed(() => {
  return (selectedAccount.value!.nickname || selectedAccount.value!.fakeid) + '-' + selectedAlbum.value!.title;
});

watch(selectedAccount, () => {
  selectedAlbum.value = undefined;
});

// 已选择的合集
const selectedAlbum = ref<AppMsgAlbumInfo | undefined>();

// 切换合集时，重置状态
watch(selectedAlbum, value => {
  isReverse.value = true;
  articleLoading.value = false;
  switchSortLoading.value = false;
  getFirstPageAlbumData().catch(e => {
    console.warn(e);
  });
});

// 合集的原始地址
const originalAlbumURL = computed(() => {
  if (selectedAccount.value && selectedAlbum.value) {
    return `https://mp.weixin.qq.com/mp/appmsgalbum?__biz=${selectedAccount.value.fakeid}&action=getalbum&album_id=${selectedAlbum.value.id}`;
  }
  return '';
});

const albumArticles: ArticleItem[] = reactive([]);
const albumBaseInfo = ref<BaseInfo | null>(null);

const isReverse = ref(true);
const albumLoading = ref(false);
const articleLoading = ref(false);
const switchSortLoading = ref(false);

const controller = ref<AbortController | null>(null);

// 加载合集第一页数据
async function getFirstPageAlbumData(refreshPage = true) {
  if (refreshPage) {
    albumLoading.value = true;
  } else {
    switchSortLoading.value = true;
  }

  if (controller.value) {
    (controller.value as AbortController).abort('切换tab，取消pending中的请求');
  }
  controller.value = new AbortController();
  const data = await $fetch<AppMsgAlbumResult>('/api/web/misc/appmsgalbum', {
    method: 'GET',
    query: {
      fakeid: selectedAccount.value!.fakeid,
      album_id: selectedAlbum.value!.id,
      is_reverse: isReverse.value ? '1' : '0',
    },
    signal: controller.value.signal,
  });

  controller.value = null;

  if (refreshPage) {
    albumLoading.value = false;
  } else {
    switchSortLoading.value = false;
  }

  albumArticles.length = 0;
  if (data.base_resp.ret === 0) {
    albumBaseInfo.value = data.getalbum_resp.base_info;
    if (Array.isArray(data.getalbum_resp.article_list)) {
      albumArticles.push(...data.getalbum_resp.article_list);
    } else {
      albumArticles.push(data.getalbum_resp.article_list);
    }
    noMoreData.value = data.getalbum_resp.continue_flag === '0';
  }
}

// 切换正序/倒序
function toggleReverse() {
  if (!selectedAccount.value || !selectedAlbum.value) {
    return;
  }

  isReverse.value = !isReverse.value;

  getFirstPageAlbumData(false).catch(e => {
    console.warn(e);
  });
}

// 加载合集后续数据
async function loadMoreData() {
  articleLoading.value = true;

  if (controller.value) {
    (controller.value as AbortController).abort('加载更多数据，取消pending中的请求');
  }
  controller.value = new AbortController();

  const lastArticle = albumArticles[albumArticles.length - 1];
  const data = await $fetch<AppMsgAlbumResult>('/api/web/misc/appmsgalbum', {
    method: 'GET',
    query: {
      fakeid: selectedAccount.value!.fakeid,
      album_id: selectedAlbum.value!.id,
      is_reverse: isReverse.value ? '1' : '0',
      begin_msgid: lastArticle?.msgid,
      begin_itemidx: lastArticle?.itemidx,
    },
    signal: controller.value.signal,
  });
  controller.value = null;
  articleLoading.value = false;

  if (data.base_resp.ret === 0) {
    if (Array.isArray(data.getalbum_resp.article_list)) {
      albumArticles.push(...data.getalbum_resp.article_list);
    } else {
      albumArticles.push(data.getalbum_resp.article_list);
    }
    noMoreData.value = data.getalbum_resp.continue_flag === '0';
  }
}

const noMoreData = ref(false);
// 判断是否触底
const bottomElementIsVisible = ref(false);

function onElementVisibility(visible: boolean) {
  bottomElementIsVisible.value = visible;
  if (visible && !noMoreData.value && !articleLoading.value) {
    loadMoreData().catch(e => {
      console.warn(e);
    });
  }
}

const {
  loading: batchDownloadLoading,
  phase: batchDownloadPhase,
  downloadedCount: batchDownloadedCount,
  packedCount: batchPackedCount,
  download: batchDownload,
} = useDownloadAlbum();
const selectedArticleCount = ref(0);

function doBatchDownload() {
  const articles: DownloadableArticle[] = albumArticles.map(article => ({
    fakeid: selectedAccount.value!.fakeid,
    title: article.title,
    url: article.url,
    date: +article.create_time,
  }));
  selectedArticleCount.value = articles.length;
  const filename = downloadFileName.value;
  batchDownload(articles, filename);
}

// 抓取全部文章链接
const fetchAllArticlesBtnLoading = ref(false);
async function fetchAllArticles() {
  fetchAllArticlesBtnLoading.value = true;
  while (!noMoreData.value) {
    await loadMoreData();
    await sleep(500);
  }
  fetchAllArticlesBtnLoading.value = false;
}
</script>

<style scoped>
.banner {
  background: linear-gradient(rgb(9, 9, 9), rgb(35, 35, 35));
}
</style>
