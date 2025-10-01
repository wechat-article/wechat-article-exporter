<template>
  <div class="relative pb-24 pt-2 bg-zinc-200 dark:bg-slate-900">
    <div class="container mx-auto">
      <ul class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <ArticleItem
          v-for="(article, index) in articleList.filter(article => (hideDeleted ? !article.is_deleted : true))"
          :key="article.aid"
          :index="index + 1"
          :title="article.title"
          :cover="article.pic_cdn_url_235_1 || article.pic_cdn_url_16_9 || article.cover_img || article.cover"
          :cover-theme="article.cover_img_theme_color"
          :digest="article.digest"
          :is-deleted="article.is_deleted"
          :link="article.link"
          :updatedAt="article.update_time"
          :is-original="article.copyright_stat === 1 && article.copyright_type === 1"
          :album-infos="article.appmsg_album_infos"
          :item-show-type="article.item_show_type"
        />
      </ul>
    </div>
    <div v-element-visibility="onElementVisibility" ref="bottomIndicatorRef"></div>
    <p v-if="loading" class="flex justify-center items-center mt-2 py-2">
      <Loader :size="28" class="animate-spin text-slate-500" />
    </p>
    <p v-else-if="noMoreData" class="text-center mt-2 py-2 text-slate-400">已全部加载完毕</p>
  </div>
</template>

<script setup lang="ts">
import type { AccountInfo, AppMsgEx } from '~/types/types';
import { Loader } from 'lucide-vue-next';
import { vElementVisibility } from '@vueuse/components';
import { getArticleList } from '~/apis';
import { getArticleCache, hitCache } from '~/store/v2/article';
import { getInfoCache } from '~/store/v2/info';
import { ARTICLE_LIST_PAGE_SIZE } from '~/config';
import type { Preferences } from '~/types/preferences';

const preferences = usePreferences();
const hideDeleted = computed(() => (preferences.value as unknown as Preferences).hideDeleted);

const bottomIndicatorRef = ref<HTMLElement | null>(null);
const toast = useToast();

const keyword = ref('');
let begin = ref(0);
const articleList = reactive<AppMsgEx[]>([]);

// 总页码
const totalPages = ref(0);
// 已加载页码数
const loadedPages = computed(() => Math.ceil(begin.value / ARTICLE_LIST_PAGE_SIZE));

const loginAccount = useLoginAccount();
const activeAccount = useActiveAccount();

defineExpose({
  init,
});

const loading = ref(false);
const noMoreData = ref(false);

async function loadData() {
  loading.value = true;
  try {
    const fakeid = activeAccount.value?.fakeid!;
    const [articles, completed, totalCount] = await getArticleList(
      activeAccount.value! as AccountInfo,
      loginAccount.value.token,
      begin.value,
      keyword.value
    );
    articleList.push(...articles);
    noMoreData.value = completed;
    if (keyword.value) {
      // 关键词搜索时的计数方式与正常的有区别
      begin.value += articles.length;
    } else {
      const count = articles.filter(article => article.itemidx === 1).length;
      begin.value += count;
    }

    totalPages.value = Math.ceil(totalCount / ARTICLE_LIST_PAGE_SIZE);

    // 加载可用的缓存
    const lastArticle = articles.at(-1);
    if (lastArticle && !keyword.value) {
      // 检查是否存在比 lastArticle 更早的缓存数据
      if (await hitCache(fakeid, lastArticle.create_time)) {
        await loadArticlesFromCache(fakeid, lastArticle.create_time);
      }
    }

    observeImages();
  } catch (e: any) {
    if (e.message === 'session expired') {
      navigateTo('/login');
    } else {
      alert(e.message);
      console.error(e);
    }
  } finally {
    loading.value = false;
  }
}

/**
 * 从缓存加载当前公众号的历史文章
 */
async function loadArticlesFromCache(fakeid: string, create_time: number) {
  const articles = await getArticleCache(fakeid, create_time);

  articleList.push(...articles);

  // 更新 begin 参数
  const count = articles.filter(article => article.itemidx === 1).length;
  begin.value += count;

  const cachedInfo = await getInfoCache(fakeid);
  if (cachedInfo && cachedInfo.completed) {
    noMoreData.value = true;
  }

  toast.add({
    title: `成功从缓存中加载了${articles.length}条数据`,
    timeout: 5000,
  });
}

/**
 * 初始化
 */
function init(query: string) {
  articleList.length = 0;
  begin.value = 0;
  noMoreData.value = false;
  keyword.value = query;

  if (bottomElementIsVisible.value) {
    loadData();
  }
}

// 判断是否触底
const bottomElementIsVisible = ref(false);

function onElementVisibility(visible: boolean) {
  bottomElementIsVisible.value = visible;
  if (visible && !noMoreData.value) {
    loadData();
  }
}

// 创建 Intersection Observer 实例
let observer = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        // 设置定时器延迟加载图片
        (entry.target as any)._timeoutId = setTimeout(() => {
          let img = entry.target as HTMLImageElement;
          img.src = img.dataset.src!;
          observer.unobserve(img);
        }, 80); // 延迟80毫秒
      } else {
        // 如果图片离开视口，清除定时器
        clearTimeout((entry.target as any)._timeoutId);
      }
    });
  },
  {
    root: null,
    rootMargin: '0px',
    threshold: 0.1,
  }
);
// 封装观察逻辑的函数
function observeImages() {
  nextTick(() => {
    document.querySelectorAll<HTMLImageElement>('img.lazyload').forEach(img => {
      if (!img.src) {
        observer.observe(img);
      }
    });
  });
}
</script>
