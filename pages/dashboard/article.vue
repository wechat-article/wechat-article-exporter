<script setup lang="ts">
import type {
  FilterChangedEvent,
  GetRowIdParams,
  ValueFormatterParams,
  ICellRendererParams,
  GridOptions,
  IAggFuncParams,
  SelectionChangedEvent,
  RowClassParams,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import type { ColDef, GridReadyEvent, GridApi, ValueGetterParams } from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community';
import { AG_GRID_LOCALE_CN } from '@ag-grid-community/locale';
import GridActions from '~/components/grid/Actions.vue';
import GridAlbum from '~/components/grid/Album.vue';
import GridLoading from '~/components/grid/Loading.vue';
import GridNoRows from '~/components/grid/NoRows.vue';
import GridStatusBar from '~/components/grid/StatusBar.vue';
import GridCoverTooltip from '~/components/grid/CoverTooltip.vue';
import { type Info } from '~/store/v2/info';
import { getArticleCache, articleDeleted } from '~/store/v2/article';
import { formatTimeStamp, sleep, ITEM_SHOW_TYPE, durationToSeconds, formatNumber } from '~/utils';
import { getHtmlCache } from '~/store/v2/html';
import { getCommentCache } from '~/store/v2/comment';
import { getMetadataCache, type Metadata } from '~/store/v2/metadata';
import type { PreviewArticle } from '#components';
import TurndownService from 'turndown';
import type { Preferences } from '~/types/preferences';
import AccountSelectorForArticle from '~/components/selector/AccountSelectorForArticle.vue';
import GridBooleanCellRenderer from '~/components/grid/BooleanCellRenderer.vue';
import {
  createBooleanColumnFilterParams,
  createDateColumnFilterParams,
  createTextColumnFilterParams,
  createNumberValueGetter,
  createBooleanValueGetter,
} from '~/utils/grid';
import { IMAGE_PROXY, isDev, websiteName } from '~/config';
import type { Article } from '~/types/article';

useHead({
  title: `文章下载 | ${websiteName}`,
});

let globalRowData: Article[] = [];

const columnDefs = ref<ColDef[]>([
  {
    headerName: '公众号',
    cellDataType: 'text',
    valueGetter: (params: ValueGetterParams<Article>) => {
      if (params.data && params.data.fakeid) {
        const fakeid = params.data.fakeid;
        return accounts.value.find(account => account.fakeid === fakeid)?.nickname;
      }
      return '';
    },
    rowGroup: false,
    filter: 'agTextColumnFilter',
    filterParams: createTextColumnFilterParams(),
    minWidth: 120,
    hide: true,
  },
  {
    headerName: 'ID',
    field: 'aid',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    filterParams: createTextColumnFilterParams(),
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '链接',
    field: 'link',
    cellDataType: 'text',
    minWidth: 150,
    sortable: false,
    filter: false,
    initialHide: true,
    cellClass: 'font-mono',
  },
  {
    headerName: '标题',
    field: 'title',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    filterParams: createTextColumnFilterParams(),
    tooltipField: 'title',
    minWidth: 200,
  },
  {
    headerName: '封面',
    field: 'cover',
    sortable: false,
    filter: false,
    cellRenderer: (params: ICellRendererParams<Article, string>) => {
      if (params.node.group) {
        return '';
      }
      return `<img alt="" src="${IMAGE_PROXY + params.value}" style="height: 40px; width: 40px; object-fit: cover;" />`;
    },
    tooltipField: 'cover',
    tooltipComponent: GridCoverTooltip,
    minWidth: 80,
    hide: true,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '摘要',
    field: 'digest',
    sortable: false,
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    filterParams: createTextColumnFilterParams(),
    tooltipField: 'digest',
    minWidth: 200,
    initialHide: true,
  },
  {
    headerName: '创建时间',
    field: 'create_time',
    valueFormatter: (params: ValueFormatterParams) => {
      return params.value !== null ? formatTimeStamp(params.value) : '';
    },
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('create_time') * 1000);
    },
    aggFunc: 'nil',
    minWidth: 180,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '发布时间',
    field: 'update_time',
    valueFormatter: (params: ValueFormatterParams) => {
      return params.value !== null ? formatTimeStamp(params.value) : '';
    },
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('update_time') * 1000);
    },
    aggFunc: 'nil',
    minWidth: 180,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '文章删除',
    field: 'is_deleted',
    cellDataType: 'boolean',
    cellRenderer: GridBooleanCellRenderer,
    valueGetter: createBooleanValueGetter('is_deleted'),
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已删除', '未删除'),
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '内容下载',
    field: 'contentDownload',
    cellDataType: 'boolean',
    cellRenderer: GridBooleanCellRenderer,
    valueGetter: createBooleanValueGetter('contentDownload'),
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已下载', '未下载'),
    minWidth: 150,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '留言下载',
    field: 'commentDownload',
    cellDataType: 'boolean',
    cellRenderer: GridBooleanCellRenderer,
    valueGetter: createBooleanValueGetter('commentDownload'),
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已下载', '未下载'),
    minWidth: 150,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '阅读数',
    field: 'readNum',
    cellDataType: 'number',
    valueGetter: createNumberValueGetter('readNum'),
    valueFormatter: (params: ValueFormatterParams) => {
      return formatNumber(params.value ?? '--');
    },
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '点赞数',
    field: 'oldLikeNum',
    cellDataType: 'number',
    valueGetter: createNumberValueGetter('oldLikeNum'),
    valueFormatter: (params: ValueFormatterParams) => {
      return formatNumber(params.value ?? '--');
    },
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '分享数',
    field: 'shareNum',
    cellDataType: 'number',
    valueGetter: createNumberValueGetter('shareNum'),
    valueFormatter: (params: ValueFormatterParams) => {
      return formatNumber(params.value ?? '--');
    },
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '喜欢数',
    field: 'likeNum',
    cellDataType: 'number',
    valueGetter: createNumberValueGetter('likeNum'),
    valueFormatter: (params: ValueFormatterParams) => {
      return formatNumber(params.value ?? '--');
    },
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '留言数',
    field: 'commentNum',
    cellDataType: 'number',
    valueGetter: createNumberValueGetter('commentNum'),
    valueFormatter: (params: ValueFormatterParams) => {
      return formatNumber(params.value ?? '--');
    },
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '作者',
    field: 'author_name',
    cellDataType: 'text',
    filter: 'agSetColumnFilter',
    minWidth: 150,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '原创',
    field: 'copyright_stat',
    cellDataType: 'boolean',
    cellRenderer: GridBooleanCellRenderer,
    valueGetter: (params: ValueGetterParams<Article>) => {
      if (params.node?.group) {
        const total = params.node.childrenAfterFilter?.length || 0;
        const count =
          params.node.childrenAfterFilter?.filter(
            row => row.data!.copyright_stat === 1 && row.data!.copyright_type === 1
          ).length || 0;
        return `${count}/${total}`;
      } else {
        return params.data && params.data.copyright_stat === 1 && params.data.copyright_type === 1;
      }
    },
    valueFormatter: (params: ValueFormatterParams) => {
      return formatNumber(params.value ?? '--');
    },
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已标记原创', '未标记原创'),
    minWidth: 150,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '文章类型',
    field: 'item_show_type',
    valueFormatter: (params: ValueFormatterParams<Article>) =>
      params.node?.group ? '' : ITEM_SHOW_TYPE[params.value] || '未识别',
    filter: 'agSetColumnFilter',
    filterParams: {
      valueFormatter: (p: ValueFormatterParams) => ITEM_SHOW_TYPE[p.value] || '未识别',
    },
    minWidth: 150,
    initialHide: true,
    aggFunc: 'nil',
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '媒体时长',
    field: 'media_duration',
    valueGetter: (params: ValueGetterParams<Article>) => durationToSeconds(params.data?.media_duration), // 用于排序和过滤
    valueFormatter: (params: ValueFormatterParams<Article>) => {
      if (params.node?.group) {
        return '';
      } else if (params.data) {
        return params.data.media_duration;
      } else {
        return '';
      }
    },
    filter: 'agNumberColumnFilter',
    comparator: (a, b) => a - b,
    minWidth: 150,
    initialHide: true,
    aggFunc: 'nil',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '所属合集',
    field: 'appmsg_album_infos',
    cellRenderer: GridAlbum,
    valueFormatter: (params: ValueFormatterParams) =>
      params.node?.group ? '' : params.value.map((album: any) => album.title).join(','),
    minWidth: 150,
    sortable: false,
    filter: false,
    initialHide: true,
  },
  {
    headerName: '操作',
    field: 'link',
    cellRenderer: GridActions,
    cellRendererParams: {
      onPreview: (params: ICellRendererParams) => {
        preview(params.data);
      },
      onGotoLink: (params: ICellRendererParams) => {
        window.open(params.value, '_blank');
      },
    },
    maxWidth: 100,
    sortable: false,
    filter: false,
    pinned: 'right',
    cellClass: 'flex justify-center items-center',
  },
]);

const rowGroupPanelShow = ref<'always' | 'onlyWhenGrouping' | 'never'>('never');
const groupDefaultExpanded = ref(0);
const gridOptions: GridOptions = {
  localeText: AG_GRID_LOCALE_CN,
  rowNumbers: {
    resizable: true,
    minWidth: 80,
    maxWidth: 120,
  },
  loadingOverlayComponent: GridLoading,
  noRowsOverlayComponent: GridNoRows,
  getRowId: (params: GetRowIdParams<Article>) => String(`${params.data.fakeid}:${params.data.aid}`),
  sideBar: {
    toolPanels: [
      {
        id: 'columns',
        labelDefault: 'Columns',
        labelKey: 'columns',
        iconKey: 'columns',
        toolPanel: 'agColumnsToolPanel',
        minWidth: 225,
        maxWidth: 225,
        width: 225,
        toolPanelParams: {
          suppressRowGroups: true,
          suppressValues: true,
          suppressPivotMode: true,
        },
      },
    ],
    position: 'right',
  },
  statusBar: {
    statusPanels: [
      {
        statusPanel: GridStatusBar,
        align: 'left',
      },
    ],
  },
  enableCellTextSelection: true,
  tooltipShowDelay: 0,
  tooltipShowMode: 'whenTruncated',
  suppressContextMenu: true,
  defaultColDef: {
    filter: true,
    flex: 1,
    enableCellChangeFlash: false,
    suppressHeaderMenuButton: true,
    suppressHeaderContextMenu: true,
    enableValue: true,
    enableRowGroup: true,
  },
  selectionColumnDef: {
    sortable: true,
    width: 50,
    pinned: 'left',
  },
  suppressAggFilteredOnly: false,
  rowSelection: {
    mode: 'multiRow',
    headerCheckbox: true,
    selectAll: 'filtered',
    // checkboxLocation: 'autoGroupColumn',
    groupSelects: 'filteredDescendants',
  },
  theme: themeQuartz.withParams({
    borderColor: '#e5e7eb',
    rowBorder: true,
    columnBorder: true,
    headerFontWeight: 700,
    oddRowBackgroundColor: '#00005506',
    sidePanelBorder: true,
  }),
};
const groupRowRendererParams = {
  suppressDoubleClickExpand: true,
};
const autoGroupColumnDef: ColDef = {
  headerName: '分组',
  minWidth: 250,
};

const aggFuncs = {
  nil(params: IAggFuncParams) {
    return null;
  },
  date(params: IAggFuncParams) {
    const values = params.values || [];
    if (values.length <= 0) {
      return null;
    }
    return values.sort((a, b) => a - b)[0];
  },
};
const rowClassRules = {
  'deleted-row': (params: RowClassParams<Article>) => {
    return !!params.data && params.data.is_deleted;
  },
};

const loading = ref(false);

const gridApi = shallowRef<GridApi<Article> | null>(null);
function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;

  restoreColumnState();
}

function onColumnStateChange() {
  if (gridApi.value) {
    saveColumnState();
  }
}
function saveColumnState() {
  const state = gridApi.value?.getColumnState();
  localStorage.setItem('agGridColumnState', JSON.stringify(state));
}

function restoreColumnState() {
  const stateStr = localStorage.getItem('agGridColumnState');
  if (stateStr) {
    const state = JSON.parse(stateStr);
    gridApi.value?.applyColumnState({
      state,
      applyOrder: true,
    });
  }
}

function onFilterChanged(event: FilterChangedEvent) {
  event.api.deselectAll();
  event.api.refreshCells({
    columns: [
      'readNum',
      'oldLikeNum',
      'shareNum',
      'likeNum',
      'commentNum',
      'is_deleted',
      'contentDownload',
      'commentDownload',
      'copyright_stat',
    ],
    force: true,
  });
}

const selectedArticles = shallowRef<Article[]>([]);
function onSelectionChanged(event: SelectionChangedEvent) {
  selectedArticles.value = (event.selectedNodes || []).map(node => node.data);
}

const preferences = usePreferences();
const hideDeleted = computed(() => (preferences.value as unknown as Preferences).hideDeleted);

const previewArticleRef = ref<typeof PreviewArticle | null>(null);

function preview(article: Article) {
  previewArticleRef.value!.open(article);
}

const selectedAccount = ref<Info | undefined>();
const accounts = ref<Info[]>([]);

watch(selectedAccount, newVal => {
  switchTableData(newVal!.fakeid).catch(() => {});
});
watch(accounts, () => {
  // refreshTableData();
});

async function refreshTableData() {
  const _accounts = toRaw(accounts.value);

  const start = Date.now();
  loading.value = true;
  globalRowData = [];
  for (const account of _accounts) {
    const articles = await queryArticlesFor(account.fakeid);
    globalRowData.push(...articles);
  }
  gridApi.value?.setGridOption('rowData', globalRowData);
  loading.value = false;
  console.log(`数据加载耗时: ${Date.now() - start}ms`);
}

async function queryArticlesFor(
  fakeid: string,
  hideDeleted: boolean = false,
  batchSize: number = 1000
): Promise<Article[]> {
  // 获取所有文章，这里可以在数据库级别根据 hideDeleted 进行筛选
  const articles = await getArticleCache(fakeid, Date.now());

  // 筛选已删除文章
  const filteredArticles = hideDeleted ? articles.filter(article => !article.is_deleted) : articles;

  const results: Article[] = [];

  // Process articles in batches
  for (let i = 0; i < filteredArticles.length; i += batchSize) {
    const batch = filteredArticles.slice(i, i + batchSize);
    const urls = batch.map(article => article.link);

    // Fetch HTML, comment, and metadata for the batch concurrently
    const [htmlResults, commentResults, metadataResults] = await Promise.all([
      Promise.all(urls.map(url => getHtmlCache(url))),
      Promise.all(urls.map(url => getCommentCache(url))),
      Promise.all(urls.map(url => getMetadataCache(url))),
    ]);

    // Combine results for the batch
    const batchResults = batch.map((article, index) => ({
      ...article,
      ...(metadataResults[index] || {}),
      contentDownload: htmlResults[index] !== undefined,
      commentDownload: commentResults[index] !== undefined,
    }));

    results.push(...batchResults);

    // Yield control to the browser to prevent freezing (optional, for very large datasets)
    await new Promise(resolve => setTimeout(resolve, 0));
  }

  return results;
}

async function switchTableData(fakeid: string) {
  loading.value = true;
  const articles = await queryArticlesFor(fakeid);
  await sleep(200);
  globalRowData = articles.filter(article => (hideDeleted.value ? !article.is_deleted : true));
  gridApi.value?.setGridOption('rowData', globalRowData);
  loading.value = false;
}

function updateRow(article: Article) {
  const rowNode = gridApi.value?.getRowNode(`${article.fakeid}:${article.aid}`);
  if (rowNode) {
    rowNode.updateData(article);
    gridApi.value?.refreshCells({
      columns: [
        'readNum',
        'oldLikeNum',
        'shareNum',
        'likeNum',
        'commentNum',
        'is_deleted',
        'contentDownload',
        'commentDownload',
        'copyright_stat',
      ],
      force: true,
    });
  }
}

const selectedArticleUrls = computed(() => {
  return selectedArticles.value.map(article => article.link);
});

const {
  loading: downloadBtnLoading,
  completed_count: downloadCompletedCount,
  total_count: downloadTotalCount,
  download,
  stop: stopDownload,
} = useDownloader({
  onContent(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.contentDownload = true;
      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update contentDownload`);
    }
  },
  onDelete(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      articleDeleted(url);
      updateRow(article);
    }
  },
  onChecking(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      articleDeleted(url);
      updateRow(article);
    }
  },
  onMetadata(url: string, metadata: Metadata) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.readNum = metadata.readNum;
      article.oldLikeNum = metadata.oldLikeNum;
      article.shareNum = metadata.shareNum;
      article.likeNum = metadata.likeNum;
      article.commentNum = metadata.commentNum;
      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update metadata`);
    }
  },
  onComment(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.commentDownload = true;
      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update commentDownload`);
    }
  },
});

const {
  loading: exportBtnLoading,
  phase: exportPhase,
  completed_count: exportCompletedCount,
  total_count: exportTotalCount,
  exportFile,
} = useExporter();

async function debug() {
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown('<h1>Hello world!</h1>');
  console.log(markdown);
}
</script>

<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">文章下载</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部公众号筛选与操作区 -->
      <header class="flex items-center gap-2 px-3 py-2">
        <AccountSelectorForArticle v-model="accounts" class="w-80" />
        <UButton color="blue" @click="refreshTableData" :loading="loading">加载</UButton>
        <div class="flex-1"></div>
        <div class="flex items-center space-x-2">
          <UButton v-if="downloadBtnLoading" color="black" @click="stopDownload">停止</UButton>
          <ButtonGroup
            :items="[
              { label: '文章内容', event: 'download-article-html' },
              { label: '阅读量 (需要Credential)', event: 'download-article-metadata' },
              { label: '留言内容 (需要Credential)', event: 'download-article-comment' },
            ]"
            @download-article-html="download('html', selectedArticleUrls)"
            @download-article-metadata="download('metadata', selectedArticleUrls)"
            @download-article-comment="download('comment', selectedArticleUrls)"
          >
            <UButton
              :loading="downloadBtnLoading"
              :disabled="selectedArticleUrls.length === 0"
              color="white"
              class="font-mono disabled:opacity-35"
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
              { label: 'Word (内测中)', event: 'export-article-word' },
              { label: 'PDF (计划中)', event: 'export-article-pdf', disabled: true },
            ]"
            @export-article-excel="exportFile('excel', selectedArticleUrls)"
            @export-article-json="exportFile('json', selectedArticleUrls)"
            @export-article-html="exportFile('html', selectedArticleUrls)"
            @export-article-txt="exportFile('text', selectedArticleUrls)"
            @export-article-markdown="exportFile('markdown', selectedArticleUrls)"
            @export-article-word="exportFile('word', selectedArticleUrls)"
            @export-article-pdf="exportFile('pdf', selectedArticleUrls)"
          >
            <UButton
              :loading="exportBtnLoading"
              :disabled="selectedArticleUrls.length === 0"
              color="white"
              class="font-mono disabled:opacity-35"
              :label="exportBtnLoading ? `${exportPhase} ${exportCompletedCount}/${exportTotalCount}` : '导出'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>
          <UButton color="fuchsia" v-if="isDev" @click="debug">调试</UButton>
        </div>
      </header>

      <AgGridVue
        style="width: 100%; height: 100%"
        :loading="loading"
        :rowData="globalRowData"
        :columnDefs="columnDefs"
        :rowGroupPanelShow="rowGroupPanelShow"
        :groupRowRendererParams="groupRowRendererParams"
        :groupDefaultExpanded="groupDefaultExpanded"
        :suppressAggFuncInHeader="true"
        :autoGroupColumnDef="autoGroupColumnDef"
        :aggFuncs="aggFuncs"
        :gridOptions="gridOptions"
        :rowClassRules="rowClassRules"
        @grid-ready="onGridReady"
        @filter-changed="onFilterChanged"
        @column-moved="onColumnStateChange"
        @column-visible="onColumnStateChange"
        @column-pinned="onColumnStateChange"
        @column-resized="onColumnStateChange"
        @selection-changed="onSelectionChanged"
      />
    </div>

    <PreviewArticle ref="previewArticleRef" />
  </div>
</template>
