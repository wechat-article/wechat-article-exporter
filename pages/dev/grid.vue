<script setup lang="ts">
import { AgGridVue } from 'ag-grid-vue3';
import {
  type ColDef,
  type GetRowIdParams,
  type GridApi,
  type GridOptions,
  type GridReadyEvent,
  type ICellRendererParams,
  type IDateFilterParams,
  themeQuartz,
  type ValueFormatterParams,
  type ValueGetterParams,
  type IAggFuncParams,
  type FilterChangedEvent,
} from 'ag-grid-community';
import GridCoverTooltip from '~/components/grid/CoverTooltip.vue';
import { durationToSeconds, formatTimeStamp, ITEM_SHOW_TYPE } from '~/utils';
import GridAlbum from '~/components/grid/Album.vue';
import { AG_GRID_LOCALE_CN } from '@ag-grid-community/locale';
import GridLoading from '~/components/grid/Loading.vue';
import GridNoRows from '~/components/grid/NoRows.vue';
import GridStatusBar from '~/components/grid/StatusBar.vue';
import GridBooleanCellRenderer from '~/components/grid/BooleanCellRenderer.vue';
import type { AppMsgEx } from '~/types/types';
import type { ArticleMetadata } from '~/utils/download/types';
import type { Info } from '~/store/v2/info';
import { getArticleCache } from '~/store/v2/article';
import { getHtmlCache } from '~/store/v2/html';
import { getCommentCache } from '~/store/v2/comment';
import { getMetadataCache } from '~/store/v2/metadata';
import AccountSelectorForArticle from '~/components/selector/AccountSelectorForArticle.vue';

// 当前页面的数据模型
interface Article extends AppMsgEx, Partial<ArticleMetadata> {
  /**
   * 是否被选中
   */
  // checked: boolean;

  /**
   * 是否显示
   */
  // display: boolean;
  /**
   * 文章内容是否已下载
   */
  contentDownload: boolean;

  /**
   * 留言内容是否已下载
   */
  commentDownload: boolean;
}

const accounts = ref<Info[]>([]);

watch(accounts, () => {
  refreshTableData();
});

async function refreshTableData() {
  const _accounts = toRaw(accounts.value);

  loading.value = true;
  globalRowData = [];
  for (const account of _accounts) {
    const articles = await queryArticlesFor(account.fakeid);
    globalRowData.push(...articles);
    gridApi.value?.setGridOption('rowData', globalRowData);
  }
  loading.value = false;
}

async function queryArticlesFor(fakeid: string) {
  const articles: Article[] = [];
  const data = await getArticleCache(fakeid, Date.now());
  for (const article of data) {
    const contentDownload = (await getHtmlCache(article.link)) !== undefined;
    const commentDownload = (await getCommentCache(article.link)) !== undefined;
    const metadata = await getMetadataCache(article.link);
    if (metadata) {
      articles.push({
        ...metadata,
        ...article,
        contentDownload: contentDownload,
        commentDownload: commentDownload,
      });
    } else {
      articles.push({
        ...article,
        contentDownload: contentDownload,
        commentDownload: commentDownload,
      });
    }
  }
  return articles;
}

const loading = ref(false);
let globalRowData: Article[] = [];

const filterParams: IDateFilterParams = {
  filterOptions: ['lessThan', 'greaterThan', 'inRange'],
  comparator: (filterLocalDateAtMidnight: Date, cellValue: Date) => {
    const t = filterLocalDateAtMidnight;
    if (cellValue < t) {
      return -1;
    } else if (cellValue === t) {
      return 0;
    } else {
      return 1;
    }
  },
};
const booleanColumnFilterParams = {
  suppressMiniFilter: true,
  values: [true, false],
  valueFormatter: (params: ValueFormatterParams) => (params.value ? '是' : '否'),
};

const rowGroupPanelShow = ref<'always' | 'onlyWhenGrouping' | 'never'>('never');
const groupDefaultExpanded = ref(0);
const columnDefs = ref<ColDef[]>([
  {
    headerName: '公众号',
    valueGetter: p => {
      if (p.data && p.data.fakeid) {
        return accounts.value.find(a => a.fakeid === p.data.fakeid)?.nickname;
      }
      return '';
    },
    rowGroup: true,
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains', 'notContains'],
      maxNumConditions: 1,
    },
    tooltipField: 'title',
    minWidth: 120,
    hide: true,
  },
  {
    headerName: 'ID',
    field: 'aid',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '链接',
    field: 'link',
    cellDataType: 'text',
    sortable: false,
    filter: false,
    minWidth: 150,
    initialHide: true,
    cellClass: 'font-mono',
  },
  {
    headerName: '标题',
    field: 'title',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains', 'notContains'],
      maxNumConditions: 1,
    },
    tooltipField: 'title',
    minWidth: 200,
  },
  {
    headerName: '封面',
    field: 'cover',
    sortable: false,
    filter: false,
    cellRenderer: (params: ICellRendererParams) => {
      if (params.node.group) {
        return '';
      }
      return `<img alt="" src="${params.value}" style="height: 40px; width: 40px; object-fit: cover;" />`;
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
    filterParams: {
      filterOptions: ['contains', 'notContains'],
      maxNumConditions: 1,
    },
    tooltipField: 'digest',
    minWidth: 200,
    initialHide: true,
  },
  {
    headerName: '创建时间',
    field: 'create_time',
    valueFormatter: p => {
      return p.value !== null ? formatTimeStamp(p.value) : '';
    },
    filter: 'agDateColumnFilter',
    filterParams: filterParams,
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('create_time') * 1000);
    },
    minWidth: 180,
    initialHide: true,
    aggFunc: 'nil',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '发布时间',
    field: 'update_time',
    minWidth: 180,
    valueFormatter: p => {
      return p.value !== null ? formatTimeStamp(p.value) : '';
    },
    filter: 'agDateColumnFilter',
    filterParams: filterParams,
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('update_time') * 1000);
    },
    aggFunc: 'nil',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '是否已删除',
    field: 'is_deleted',
    cellDataType: 'boolean',
    cellRenderer: GridBooleanCellRenderer,
    valueGetter: (params: ValueGetterParams) => {
      if (params.node?.group) {
        const total = params.node.childrenAfterFilter?.length || 0;
        const count = params.node.childrenAfterFilter?.filter(row => row.data.is_deleted).length || 0;
        return `${count}/${total}`;
      } else {
        return params.data.is_deleted;
      }
    },
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
    minWidth: 150,
    initialHide: true,
    // aggFunc: 'boolean',
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '内容已下载',
    field: 'contentDownload',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
    minWidth: 150,
    aggFunc: 'boolean',
    cellClass: 'flex justify-center items-center',
  },
  {
    field: 'commentDownload',
    headerName: '留言已下载',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
    minWidth: 150,
    aggFunc: 'boolean',
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '阅读',
    field: 'readNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    aggFunc: 'sum',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '点赞',
    field: 'oldLikeNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    aggFunc: 'sum',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '分享',
    field: 'shareNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    aggFunc: 'sum',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '喜欢',
    field: 'likeNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    aggFunc: 'sum',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '留言',
    field: 'commentNum',
    cellDataType: 'number',
    filter: 'agNumberColumnFilter',
    minWidth: 100,
    aggFunc: 'sum',
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    field: 'author_name',
    headerName: '作者',
    cellDataType: 'text',
    filter: 'agSetColumnFilter',
    minWidth: 150,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '是否原创',
    valueGetter: p => p.data && p.data.copyright_stat === 1 && p.data.copyright_type === 1,
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
    minWidth: 150,
    aggFunc: 'boolean',
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '文章类型',
    field: 'item_show_type',
    valueFormatter: params => (params.node?.group ? '' : ITEM_SHOW_TYPE[params.value] || '未识别'),
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
    valueGetter: params => durationToSeconds(params.data.media_duration), // 用于排序和过滤
    valueFormatter: params => (params.node?.group ? '' : params.data.media_duration),
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
    sortable: false,
    filter: false,
    valueFormatter: params => (params.node?.group ? '' : params.value.map((album: any) => album.title).join(',')),
    minWidth: 150,
    initialHide: true,
  },
]);
const gridOptions: GridOptions = {
  localeText: AG_GRID_LOCALE_CN,
  rowNumbers: {
    resizable: true,
    minWidth: 80,
    maxWidth: 120,
  },
  loadingOverlayComponent: GridLoading,
  noRowsOverlayComponent: GridNoRows,
  getRowId: (params: GetRowIdParams) => String(params.data.aid),
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
      {
        id: 'filters',
        labelDefault: 'Filters',
        labelKey: 'filters',
        iconKey: 'filter',
        toolPanel: 'agFiltersToolPanel',
        minWidth: 180,
        maxWidth: 400,
        width: 250,
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
    checkboxLocation: 'autoGroupColumn',
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
const autoGroupColumnDef = {
  headerName: '分组',
  minWidth: 250,
};

const gridApi = shallowRef<GridApi<Article> | null>(null);
function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;
}

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
  boolean(params: IAggFuncParams) {
    const values = params.values || [];
    return values.every(v => !!v);
  },
};
function onFilterChanged(event: FilterChangedEvent) {
  event.api.refreshCells({
    columns: ['is_deleted'],
    force: true,
  });
}
</script>

<template>
  <AccountSelectorForArticle v-model="accounts" class="w-60" />

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
    @grid-ready="onGridReady"
    @filter-changed="onFilterChanged"
  />
</template>
