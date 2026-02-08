<script setup lang="ts">
import {
  type ColDef,
  type FilterChangedEvent,
  type GetRowIdParams,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
  type ICellRendererParams,
  type SelectionChangedEvent,
  type ValueFormatterParams,
  type ValueGetterParams,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import dayjs from 'dayjs';
import { defu } from 'defu';
import { onMounted } from 'vue';
import { formatTimeStamp } from '#shared/utils/helpers';
import GridArticleActions from '~/components/grid/ArticleActions.vue';
import GridLoading from '~/components/grid/Loading.vue';
import GridNoRows from '~/components/grid/NoRows.vue';
import PreviewArticle from '~/components/preview/Article.vue';
import toastFactory from '~/composables/toast';
import { websiteName } from '~/config';
import { sharedGridOptions } from '~/config/shared-grid-options';
import { articleDeleted, updateArticleFakeid, updateArticleStatus } from '~/store/v2/article';
import { db } from '~/store/v2/db';
import { getHtmlCache } from '~/store/v2/html';
import type { Metadata } from '~/store/v2/metadata';
import type { Preferences } from '~/types/preferences';
import type { AppMsgExWithFakeID } from '~/types/types';
import type { ArticleMetadata } from '~/utils/download/types';
import { createBooleanColumnFilterParams, createDateColumnFilterParams } from '~/utils/grid';

useHead({
  title: `单篇文章下载 | ${websiteName}`,
});

interface SingleArticleRow extends Partial<ArticleMetadata> {
  id: string;
  fakeid: string;
  link: string;
  title: string;
  author_name: string;
  digest: string;
  cover?: string;
  create_time: number;
  update_time: number;
  appmsgid: number;
  itemidx: number;
  aid: string;
  contentDownload: boolean;
  commentDownload: boolean;
  accountName?: string | null;
  _status: string;
  is_deleted: boolean;
}

const preferences = usePreferences();

const toast = toastFactory();
const inputUrl = ref('');

const globalRowData = useLocalStorage<SingleArticleRow[]>('single-article:rows', []);
if (!globalRowData.value) {
  globalRowData.value = [];
}

const columnDefs = ref<ColDef[]>([
  {
    headerName: 'fakeid',
    field: 'fakeid',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    minWidth: 220,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '标题',
    field: 'title',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    flex: 2,
    minWidth: 220,
    tooltipField: 'title',
  },
  {
    headerName: '链接',
    field: 'link',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    flex: 3,
    minWidth: 240,
    cellClass: 'font-mono',
  },
  {
    headerName: '文章状态',
    field: '_status',
    valueFormatter: p => p.value,
    filter: 'agSetColumnFilter',
    filterParams: {
      valueFormatter: (p: ValueFormatterParams) => p.value,
    },
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '作者',
    field: 'author_name',
    cellDataType: 'text',
    filter: 'agSetColumnFilter',
    flex: 1,
    minWidth: 140,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '发布时间',
    field: 'update_time',
    valueFormatter: (params: ValueFormatterParams) => (params.value ? formatTimeStamp(params.value) : '--'),
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('update_time') * 1000);
    },
    flex: 1,
    minWidth: 180,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '内容已下载',
    field: 'contentDownload',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已下载', '未下载'),
    minWidth: 140,
    cellClass: 'flex justify-center items-center',
  },
  {
    field: 'commentDownload',
    headerName: '留言已下载',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已下载', '未下载'),
    minWidth: 150,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '阅读',
    field: 'readNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '点赞',
    field: 'oldLikeNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '分享',
    field: 'shareNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '喜欢',
    field: 'likeNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '留言',
    field: 'commentNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '操作',
    colId: 'single-action',
    field: 'link',
    sortable: false,
    filter: false,
    cellRenderer: GridArticleActions,
    cellRendererParams: {
      onPreview: (params: ICellRendererParams) => {
        previewRow(params.data as SingleArticleRow);
      },
      onGotoLink: (params: ICellRendererParams) => {
        window.open(params.value as string, '_blank', 'noopener');
      },
    },
    width: 110,
    pinned: 'right',
    cellClass: 'flex justify-center items-center',
  },
]);

// 注意，`defu`函数最左边的参数优先级最高
const gridOptions: GridOptions = defu(
  {
    animateRows: true,
    columnDefs: columnDefs.value,
    getRowId: (params: GetRowIdParams) => params.data.id,
    components: {
      agLoadingOverlay: GridLoading,
      agNoRowsOverlay: GridNoRows,
    },
    overlayLoadingTemplate: '<grid-loading />',
    overlayNoRowsTemplate: '<grid-no-rows />',
  },
  sharedGridOptions
);

const gridApi = shallowRef<GridApi | null>(null);
const previewArticleRef = ref<typeof PreviewArticle | null>(null);

function refreshGrid() {
  gridApi.value?.setGridOption('rowData', globalRowData.value);
}

function onGridReady(event: GridReadyEvent) {
  gridApi.value = event.api;
}

function onFilterChanged(event: FilterChangedEvent) {
  event.api.deselectAll();
}

watch(
  globalRowData,
  () => {
    refreshGrid();
  },
  { deep: true }
);

onMounted(() => {
  globalRowData.value.forEach(row => {
    upsertArticleStub(row);
  });
});

function normalizeUrl(url: string) {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('链接不能为空');
  const hasProtocol = /^https?:\/\//i.test(trimmed);
  const normalized = hasProtocol ? trimmed : `https://${trimmed}`;
  const parsed = new URL(normalized);
  if (parsed.hostname !== 'mp.weixin.qq.com') {
    throw new Error('请输入有效的公众号文章链接!');
  }
  return parsed.toString();
}

function parseUrlParams(url: string) {
  const parsed = new URL(url);
  const params = parsed.searchParams;
  const fakeid = params.get('__biz') || 'SINGLE_ARTICLE_FAKEID';
  const mid = params.get('mid') || params.get('appmsgid') || `${Date.now()}`;
  const idx = params.get('idx') || params.get('itemidx') || '1';
  return { fakeid, mid: Number(mid), idx: Number(idx) || 1 };
}

function createRow(url: string): SingleArticleRow {
  const { fakeid, mid, idx } = parseUrlParams(url);
  const timestamp = dayjs().unix();
  const aid = `${mid}_${idx}`;
  const generatedId =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
  return {
    id: generatedId,
    fakeid,
    link: url,
    title: '未命名文章',
    author_name: '--',
    digest: '',
    create_time: timestamp,
    update_time: timestamp,
    appmsgid: mid,
    itemidx: idx,
    aid,
    contentDownload: false,
    commentDownload: false,
    accountName: null,
    _status: '',
    is_deleted: false,
  };
}

async function addArticle() {
  try {
    const normalized = normalizeUrl(inputUrl.value);
    if (globalRowData.value.some(row => row.link === normalized)) {
      toast.info('提示', '该链接已存在列表中');
      return;
    }
    const row = createRow(normalized);
    globalRowData.value = [row, ...globalRowData.value];
    await upsertArticleStub(row);
    refreshGrid();
    inputUrl.value = '';
    await downloadRows([row], { silent: true });
  } catch (error: any) {
    toast.error('添加失败', error?.message || '链接格式不正确');
  }
}

function buildVirtualArticle(row: SingleArticleRow): AppMsgExWithFakeID {
  return {
    fakeid: row.fakeid,
    _status: '',
    aid: row.aid,
    album_id: '',
    appmsg_album_infos: [],
    appmsgid: row.appmsgid,
    author_name: row.author_name || '',
    ban_flag: 0,
    checking: 0,
    copyright_stat: 0,
    copyright_type: 0,
    cover: row.cover || '',
    cover_img: row.cover || '',
    cover_img_theme_color: undefined,
    create_time: row.create_time,
    digest: row.digest,
    has_red_packet_cover: 0,
    is_deleted: false,
    is_pay_subscribe: 0,
    item_show_type: 0,
    itemidx: row.itemidx,
    link: row.link,
    media_duration: '0:00',
    mediaapi_publish_status: 0,
    pic_cdn_url_1_1: row.cover || '',
    pic_cdn_url_3_4: row.cover || '',
    pic_cdn_url_16_9: row.cover || '',
    pic_cdn_url_235_1: row.cover || '',
    title: row.title,
    update_time: row.update_time,
    _single: true,
  };
}

function upsertArticleStub(row: SingleArticleRow) {
  return db.article.put(buildVirtualArticle(row), `${row.fakeid}:${row.aid}`);
}

function getSelectedRows(): SingleArticleRow[] {
  if (!gridApi.value) return [];
  return gridApi.value.getSelectedRows() as SingleArticleRow[];
}

function updateRow(article: SingleArticleRow) {
  const rowNode = gridApi.value?.getRowNode(article.id);
  if (rowNode) {
    rowNode.updateData(article);
  }
}

const selectedArticles = shallowRef<SingleArticleRow[]>([]);
function onSelectionChanged(event: SelectionChangedEvent) {
  selectedArticles.value = (event.selectedNodes || []).map(node => node.data);
}
const selectedArticleUrls = computed(() => {
  return selectedArticles.value.map(article => article.link);
});

const {
  loading: downloadBtnLoading,
  completed_count: downloadCompletedCount,
  total_count: downloadTotalCount,
  download,
} = useDownloader({
  onFakeID(url: string, fakeid: string) {
    const article = globalRowData.value.find(article => article.link === url);
    if (article) {
      article.fakeid = fakeid;
      updateRow(article);

      updateArticleFakeid(url, fakeid);
    }
  },
  async onContent(url: string) {
    const article = globalRowData.value.find(article => article.link === url);
    if (article) {
      article.contentDownload = true;
      article._status = '正常';
      await updateRowFromHtml(article);

      await updateArticleStatus(url, '正常');

      // 修复之前代码逻辑错误导致的数据库状态被误设置为【已删除】
      article.is_deleted = false;
      await articleDeleted(url, false);

      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update contentDownload`);
    }
  },
  onStatusChange(url: string, status: string) {
    const article = globalRowData.value.find(article => article.link === url);
    if (article) {
      article._status = status;
      updateRow(article);

      updateArticleStatus(url, status);
    }
  },
  onDelete(url: string) {
    const article = globalRowData.value.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      article._status = '已删除';
      updateRow(article);

      updateArticleStatus(url, '已删除');
      articleDeleted(url);
    }
  },
  onMetadata(url: string, metadata: Metadata) {
    const article = globalRowData.value.find(article => article.link === url);
    if (article) {
      article.readNum = metadata.readNum;
      article.oldLikeNum = metadata.oldLikeNum;
      article.shareNum = metadata.shareNum;
      article.likeNum = metadata.likeNum;
      article.commentNum = metadata.commentNum;

      if ((preferences.value as unknown as Preferences).downloadConfig.metadataOverrideContent) {
        // 如果同步下载文章内容，则更新相关字段
        article.contentDownload = true;
        article._status = '正常';
        updateArticleStatus(url, '正常');

        // 修复之前代码逻辑错误导致的数据库状态被误设置为【已删除】
        article.is_deleted = false;
        articleDeleted(url, false);
      }

      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update metadata`);
    }
  },
  onComment(url: string) {
    const article = globalRowData.value.find(article => article.link === url);
    if (article) {
      article.commentDownload = true;
      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update commentDownload`);
    }
  },
});

async function downloadRows(targetRows: SingleArticleRow[], options: { silent?: boolean } = {}) {
  const { silent = false } = options;
  if (targetRows.length === 0) {
    if (!silent) {
      toast.info('提示', '请先选择至少一篇文章');
    }
    return;
  }

  await Promise.all(
    targetRows.map(async row => {
      updateRow(row);
      await upsertArticleStub(row);
    })
  );

  const urls = targetRows.map(row => row.link);
  await download('html', urls);
}

async function updateRowFromHtml(row: SingleArticleRow) {
  const cache = await getHtmlCache(row.link);
  if (!cache) return;
  const html = await cache.file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const title = doc.querySelector('#activity-name')?.textContent?.trim();
  const author =
    doc.querySelector('#js_author_name')?.textContent?.trim() || doc.querySelector('#js_name')?.textContent?.trim();
  const digest = doc.querySelector('#js_content')?.textContent?.trim()?.slice(0, 160) || row.digest;
  const cover =
    doc.querySelector<HTMLImageElement>('#js_cover')?.getAttribute('data-src') ||
    doc.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.getAttribute('content') ||
    row.cover ||
    '';
  const publishText = doc.querySelector('#publish_time')?.textContent?.trim();
  const ctMatch = html.match(/var ct = "(?<ts>\d+)";/);

  if (title) row.title = title;
  if (author) row.author_name = author;
  row.accountName = doc.querySelector('#js_name')?.textContent?.trim() || row.accountName || null;
  row.digest = digest || '';
  row.cover = cover;

  if (ctMatch?.groups?.ts) {
    row.update_time = Number(ctMatch.groups.ts);
  } else if (publishText) {
    const parsed = dayjs(publishText);
    if (parsed.isValid()) {
      row.update_time = parsed.unix();
    }
  }

  await db.article.put(
    {
      ...buildVirtualArticle(row),
      digest: row.digest,
      cover: cover,
      cover_img: cover,
      pic_cdn_url_1_1: cover,
      pic_cdn_url_3_4: cover,
      pic_cdn_url_16_9: cover,
      pic_cdn_url_235_1: cover,
    },
    `${row.fakeid}:${row.aid}`
  );
}

function previewRow(row: SingleArticleRow) {
  if (!row.contentDownload) {
    toast.warning('提示', '请先抓取该文章内容');
    return;
  }
  const article = buildVirtualArticle(row) as AppMsgExWithFakeID;
  previewArticleRef.value?.open(article);
}

const {
  loading: exportBtnLoading,
  phase: exportPhase,
  completed_count: exportCompletedCount,
  total_count: exportTotalCount,
  exportFile,
} = useExporter();

async function deleteRowData(row: SingleArticleRow) {
  const key = `${row.fakeid}:${row.aid}`;
  await db.transaction('rw', ['article', 'html'], async () => {
    await db.article.delete(key);
    await db.html.delete(row.link);
  });
}

async function removeRows() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    toast.info('提示', '请选择要移除的文章');
    return;
  }
  try {
    await Promise.all(selectedRows.map(row => deleteRowData(row)));
    globalRowData.value = globalRowData.value.filter(row => !selectedRows.some(sel => sel.id === row.id));
    gridApi.value?.deselectAll();
    refreshGrid();
    toast.success('移除成功', `已移除 ${selectedRows.length} 篇文章`);
  } catch (error: any) {
    toast.error('移除失败', error?.message || '删除本地缓存时出错');
  }
}
</script>

<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">单篇文章下载</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部操作区 -->
      <header class="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-3 py-3">
        <div class="flex flex-1 gap-3">
          <UInput v-model="inputUrl" placeholder="请输入公众号文章链接" class="flex-1" @keyup.enter="addArticle" />
          <UButton color="blue" @click="addArticle">添加</UButton>
        </div>
        <div class="flex items-center gap-3">
          <ButtonGroup
            :items="[
              { label: '修复fakeid', event: 'fix-fakeid' },
              { label: '文章内容', event: 'download-article-html' },
              { label: '阅读量 (需要Credential)', event: 'download-article-metadata' },
              { label: '留言内容 (需要Credential)', event: 'download-article-comment' },
            ]"
            @fix-fakeid="download('fakeid', selectedArticleUrls)"
            @download-article-html="download('html', selectedArticleUrls)"
            @download-article-metadata="download('metadata', selectedArticleUrls)"
            @download-article-comment="download('comment', selectedArticleUrls)"
          >
            <UButton
              :loading="downloadBtnLoading"
              :disabled="selectedArticleUrls.length === 0"
              color="white"
              class="font-mono"
              :label="downloadBtnLoading ? `抓取中 ${downloadCompletedCount}/${downloadTotalCount}` : '抓取'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>

          <ButtonGroup
            :items="[
              { label: 'Excel', event: 'export-article-excel' },
              { label: 'JSON', event: 'export-article-json' },
              { label: 'HTML', event: 'export-article-html' },
              { label: 'Txt', event: 'export-article-text' },
              { label: 'Markdown', event: 'export-article-markdown' },
            ]"
            @export-article-excel="exportFile('excel', selectedArticleUrls)"
            @export-article-json="exportFile('json', selectedArticleUrls)"
            @export-article-html="exportFile('html', selectedArticleUrls)"
            @export-article-text="exportFile('text', selectedArticleUrls)"
            @export-article-markdown="exportFile('markdown', selectedArticleUrls)"
          >
            <UButton
              :loading="exportBtnLoading"
              :disabled="selectedArticleUrls.length === 0"
              color="white"
              class="font-mono"
              :label="exportBtnLoading ? `${exportPhase} ${exportCompletedCount}/${exportTotalCount}` : '导出'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>

          <UButton color="rose" variant="soft" :disabled="selectedArticleUrls.length === 0" @click="removeRows">
            移除
          </UButton>
        </div>
      </header>

      <ag-grid-vue
        style="width: 100%; height: 100%"
        :rowData="globalRowData"
        :columnDefs="columnDefs"
        :gridOptions="gridOptions"
        @grid-ready="onGridReady"
        @filter-changed="onFilterChanged"
        @selection-changed="onSelectionChanged"
      />
    </div>

    <PreviewArticle ref="previewArticleRef" />
  </div>
</template>
