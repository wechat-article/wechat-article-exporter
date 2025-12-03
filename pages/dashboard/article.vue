<script setup lang="ts">
import {
  type FilterChangedEvent,
  type GetRowIdParams,
  type ValueFormatterParams,
  type ICellRendererParams,
  type GridOptions,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import type { ColDef, GridReadyEvent, GridApi, IDateFilterParams, ValueGetterParams } from 'ag-grid-community';
import { themeQuartz } from 'ag-grid-community';
import GridActions from '~/components/grid/Actions.vue';
import GridAlbum from '~/components/grid/Album.vue';
import GridLoading from '~/components/grid/Loading.vue';
import GridNoRows from '~/components/grid/NoRows.vue';
import GridStatusBar from '~/components/grid/StatusBar.vue';
import GridCoverTooltip from '~/components/grid/CoverTooltip.vue';
import { AG_GRID_LOCALE_CN } from '@ag-grid-community/locale';
import { type Info } from '~/store/v2/info';
import { getArticleCache, articleDeleted, getArticleByLink } from '~/store/v2/article';
import type { AppMsgEx } from '~/types/types';
import { formatElapsedTime, formatTimeStamp, sleep, ITEM_SHOW_TYPE, durationToSeconds } from '~/utils';
import { Downloader } from '~/utils/download/Downloader';
import { Exporter } from '~/utils/download/Exporter';
import { getHtmlCache } from '~/store/v2/html';
import { getCommentCache } from '~/store/v2/comment';
import type { ArticleMetadata, DownloaderStatus, ExporterStatus } from '~/utils/download/types';
import { getMetadataCache, type Metadata } from '~/store/v2/metadata';
import type { PreviewArticle } from '#components';
import type { Preferences } from '~/types/preferences';
import AccountSelectorForArticle from '~/components/selector/AccountSelectorForArticle.vue';
import { isDev } from '~/config';

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

const columnDefs = ref<ColDef[]>([
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
    valueFormatter: p => formatTimeStamp(p.value),
    filter: 'agDateColumnFilter',
    filterParams: filterParams,
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('create_time') * 1000);
    },
    minWidth: 180,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '发布时间',
    field: 'update_time',
    minWidth: 180,
    valueFormatter: p => formatTimeStamp(p.value),
    filter: 'agDateColumnFilter',
    filterParams: filterParams,
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('update_time') * 1000);
    },
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '是否已删除',
    field: 'is_deleted',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '内容已下载',
    field: 'contentDownload',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
    minWidth: 150,
    cellClass: 'flex justify-center items-center',
  },
  {
    field: 'commentDownload',
    headerName: '留言已下载',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: booleanColumnFilterParams,
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
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '文章类型',
    field: 'item_show_type',
    valueFormatter: p => ITEM_SHOW_TYPE[p.value] || '未识别',
    filter: 'agSetColumnFilter',
    filterParams: {
      valueFormatter: (p: ValueFormatterParams) => ITEM_SHOW_TYPE[p.value] || '未识别',
    },
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center',
  },
  {
    headerName: '媒体时长',
    field: 'media_duration',
    valueGetter: params => durationToSeconds(params.data.media_duration), // 用于排序和过滤
    valueFormatter: params => params.data.media_duration,
    filter: 'agNumberColumnFilter',
    comparator: (a, b) => a - b,
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '所属合集',
    field: 'appmsg_album_infos',
    cellRenderer: GridAlbum,
    sortable: false,
    filter: false,
    valueFormatter: p => p.value.map((album: any) => album.title).join(','),
    minWidth: 150,
    initialHide: true,
  },
  {
    headerName: '操作',
    field: 'link',
    sortable: false,
    filter: false,
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
    pinned: 'right',
    cellClass: 'flex justify-center items-center',
  },
]);

const gridOptions: GridOptions = {
  localeText: AG_GRID_LOCALE_CN,
  rowNumbers: true,
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
    width: 80,
    pinned: 'left',
  },
  rowSelection: {
    mode: 'multiRow',
    headerCheckbox: true,
    selectAll: 'filtered',
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

const loading = ref(false);

const gridApi = shallowRef<GridApi | null>(null);
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
}

const preferences = usePreferences();
const hideDeleted = computed(() => (preferences.value as unknown as Preferences).hideDeleted);

const previewArticleRef = ref<typeof PreviewArticle | null>(null);

function preview(article: Article) {
  previewArticleRef.value!.open(article);
}

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

useHead({
  title: '文章链接 | 微信公众号文章导出',
});

const selectedAccount = ref<Info | undefined>();

watch(selectedAccount, newVal => {
  switchTableData(newVal!.fakeid).catch(() => {});
});

function getSelectedRows() {
  return gridApi.value?.getSelectedRows() || [];
}

async function switchTableData(fakeid: string) {
  loading.value = true;
  const articles: Article[] = [];
  const data = await getArticleCache(fakeid, Date.now());
  for (const article of data) {
    const htmlCache = await getHtmlCache(article.link);
    const contentDownload = htmlCache !== undefined;
    const commentDownload = (await getCommentCache(article.link)) !== undefined;
    const metadata = await getMetadataCache(article.link);

    // 如果已下载 HTML，从 HTML 中重新解析原创标志（更准确）
    let copyrightStat = article.copyright_stat;
    let copyrightType = article.copyright_type;
    if (htmlCache) {
      try {
        const html = await htmlCache.file.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const isOriginal = doc.querySelector('#copyright_logo')?.textContent?.includes('原创');
        copyrightStat = isOriginal ? 1 : 0;
        copyrightType = isOriginal ? 1 : 0;
      } catch (err) {
        console.warn(`Failed to parse copyright from HTML for ${article.link}`, err);
      }
    }

    if (metadata) {
      articles.push({
        ...metadata,
        ...article,
        copyright_stat: copyrightStat,
        copyright_type: copyrightType,
        contentDownload: contentDownload,
        commentDownload: commentDownload,
      });
    } else {
      articles.push({
        ...article,
        copyright_stat: copyrightStat,
        copyright_type: copyrightType,
        contentDownload: contentDownload,
        commentDownload: commentDownload,
      });
    }
  }
  await sleep(200);
  globalRowData = articles.filter(article => (hideDeleted.value ? !article.is_deleted : true));
  gridApi.value?.setGridOption('rowData', globalRowData);
  loading.value = false;
}

const toast = useToast();

function showToast(title: string, description: string) {
  toast.add({
    color: 'rose',
    title: title,
    description: description,
    icon: 'i-octicon:bell-24',
  });
}

function updateRow(article: Article) {
  const rowNode = gridApi.value?.getRowNode(article.aid);
  if (rowNode) {
    rowNode.updateData(article);
  }
}

const downloadBtnLoading = ref(false);
const progress_1 = ref(0);
const progress_2 = ref(0);

// 抓取文章HTML
async function downloadArticleHTML() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Downloader(urls);
  manager.on('download:progress', async (url: string, success: boolean, status: DownloaderStatus) => {
    console.debug(
      `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
    );
    progress_1.value = status.completed.length;
    if (success) {
      const article = globalRowData.find(article => article.link === url);
      if (article) {
        article.contentDownload = true;

        // 从下载的 HTML 中解析原创标志
        try {
          const htmlCache = await getHtmlCache(url);
          if (htmlCache) {
            const html = await htmlCache.file.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const isOriginal = doc.querySelector('#copyright_logo')?.textContent?.includes('原创');
            article.copyright_stat = isOriginal ? 1 : 0;
            article.copyright_type = isOriginal ? 1 : 0;
          }
        } catch (err) {
          console.warn(`Failed to parse copyright from HTML for ${url}`, err);
        }

        updateRow(article);
      } else {
        console.warn(`${url} not found in table data when update contentDownload`);
      }
    }
  });
  manager.on('download:deleted', (url: string) => {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      articleDeleted(url);
      updateRow(article);
    }
  });
  manager.on('download:checking', (url: string) => {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      articleDeleted(url);
      updateRow(article);
    }
  });
  manager.on('download:begin', () => {
    console.debug('开始抓取【文章内容】...');
    progress_1.value = 0;
    progress_2.value = urls.length;
  });
  manager.on('download:finish', (seconds: number, status: DownloaderStatus) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: '【文章内容】抓取完成',
      description: `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    downloadBtnLoading.value = true;
    await manager.startDownload('html');
  } catch (error) {
    console.error('【文章内容】抓取失败:', error);
    alert((error as Error).message);
  } finally {
    downloadBtnLoading.value = false;
  }
}

// 抓取文章阅读量、点赞量等元数据
async function downloadArticleMetadata() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Downloader(urls);
  manager.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
    console.debug(
      `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
    );
    progress_1.value = status.completed.length;
  });
  manager.on('download:metadata', (url: string, metadata: Metadata) => {
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
  });
  manager.on('download:deleted', (url: string) => {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      articleDeleted(url);
      updateRow(article);
    }
  });
  manager.on('download:checking', (url: string) => {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      articleDeleted(url);
      updateRow(article);
    }
  });
  manager.on('download:begin', () => {
    console.debug('开始抓取【阅读量】...');
    progress_1.value = 0;
    progress_2.value = urls.length;
  });
  manager.on('download:finish', (seconds: number, status: DownloaderStatus) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: '【阅读量】抓取完成',
      description: `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}, 检测到已被删除:${status.deleted.length}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    downloadBtnLoading.value = true;
    await manager.startDownload('metadata');
  } catch (error) {
    console.error('【阅读量】抓取失败:', error);
    alert((error as Error).message);
  } finally {
    downloadBtnLoading.value = false;
  }
}

// 抓取文章留言数据
async function downloadArticleComment() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Downloader(urls);
  manager.on('download:progress', (url: string, success: boolean, status: DownloaderStatus) => {
    console.debug(
      `进度: (进行中:${status.pending.length} / 已完成:${status.completed.length} / 已失败:${status.failed.length} / 已删除:${status.deleted.length})`
    );
    progress_1.value = status.completed.length;
    if (success) {
      const article = globalRowData.find(article => article.link === url);
      if (article) {
        article.commentDownload = true;
        updateRow(article);
      } else {
        console.warn(`${url} not found in table data when update commentDownload`);
      }
    }
  });
  manager.on('download:begin', () => {
    console.debug('开始抓取【留言内容】...');
    progress_1.value = 0;
    progress_2.value = urls.length;
  });
  manager.on('download:finish', (seconds: number, status: DownloaderStatus) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: '【留言内容】抓取完成',
      description: `本次抓取耗时 ${formatElapsedTime(seconds)}, 成功:${status.completed.length}, 失败:${status.failed.length}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    downloadBtnLoading.value = true;
    await manager.startDownload('comments');
  } catch (error) {
    console.error('【留言内容】抓取失败:', error);
    alert((error as Error).message);
  } finally {
    downloadBtnLoading.value = false;
  }
}

const exportBtnLoading = ref(false);
const exportPhase = ref('导出中');

// 导出 excel
async function export2excel() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Exporter(urls);
  manager.on('export:begin', () => {
    exportPhase.value = '导出中';
    progress_1.value = 0;
    progress_2.value = 0;
  });
  manager.on('export:total', (total: number) => {
    progress_2.value = total;
  });
  manager.on('export:progress', (num: number) => {
    progress_1.value = num;
  });
  manager.on('export:finish', (seconds: number) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: 'Excel 导出完成',
      description: `本次导出耗时 ${formatElapsedTime(seconds)}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    exportBtnLoading.value = true;
    await manager.startExport('excel');
  } catch (error) {
    console.error('导出任务失败:', error);
    alert((error as Error).message);
  } finally {
    exportBtnLoading.value = false;
  }
}

// 导出 json
async function export2json() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Exporter(urls);
  manager.on('export:begin', () => {
    exportPhase.value = '导出中';
    progress_1.value = 0;
    progress_2.value = 0;
  });
  manager.on('export:total', (total: number) => {
    progress_2.value = total;
  });
  manager.on('export:progress', (num: number) => {
    progress_1.value = num;
  });
  manager.on('export:finish', (seconds: number) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: 'Json 导出完成',
      description: `本次导出耗时 ${formatElapsedTime(seconds)}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    exportBtnLoading.value = true;
    await manager.startExport('json');
  } catch (error) {
    console.error('导出任务失败:', error);
    alert((error as Error).message);
  } finally {
    exportBtnLoading.value = false;
  }
}

// 导出 html
async function export2html() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Exporter(urls);
  manager.on('export:begin', () => {
    exportPhase.value = '资源解析中';
    progress_1.value = 0;
    progress_2.value = 0;
  });
  manager.on('export:download', (total: number) => {
    exportPhase.value = '资源下载中';
    progress_1.value = 0;
    progress_2.value = total;
  });
  manager.on('export:download:progress', (url: string, success: boolean, status: ExporterStatus) => {
    progress_1.value = status.completed.length;
  });
  manager.on('export:write', (total: number) => {
    exportPhase.value = '文件写入中';
    progress_1.value = 0;
    progress_2.value = total;
  });
  manager.on('export:write:progress', (index: number) => {
    progress_1.value = index;
  });
  manager.on('export:finish', (seconds: number) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: 'HTML 导出完成',
      description: `本次导出耗时 ${formatElapsedTime(seconds)}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    exportBtnLoading.value = true;
    await manager.startExport('html');
  } catch (error) {
    console.error('导出任务失败:', error);
    alert((error as Error).message);
  } finally {
    exportBtnLoading.value = false;
  }
}

// 导出 txt
async function export2txt() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Exporter(urls);
  manager.on('export:begin', () => {
    exportPhase.value = '资源解析中';
    progress_1.value = 0;
    progress_2.value = 0;
  });
  manager.on('export:total', (total: number) => {
    exportPhase.value = '导出中';
    progress_1.value = 0;
    progress_2.value = total;
  });
  manager.on('export:progress', (index: number) => {
    progress_1.value = index;
  });
  manager.on('export:finish', (seconds: number) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: 'Txt 导出完成',
      description: `本次导出耗时 ${formatElapsedTime(seconds)}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    exportBtnLoading.value = true;
    await manager.startExport('txt');
  } catch (error) {
    console.error('导出任务失败:', error);
    alert((error as Error).message);
  } finally {
    exportBtnLoading.value = false;
  }
}

// 导出 markdown
async function export2markdown() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Exporter(urls);
  manager.on('export:begin', () => {
    exportPhase.value = '资源解析中';
    progress_1.value = 0;
    progress_2.value = 0;
  });
  manager.on('export:total', (total: number) => {
    exportPhase.value = '导出中';
    progress_1.value = 0;
    progress_2.value = total;
  });
  manager.on('export:progress', (index: number) => {
    progress_1.value = index;
  });
  manager.on('export:finish', (seconds: number) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: 'Markdown 导出完成',
      description: `本次导出耗时 ${formatElapsedTime(seconds)}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    exportBtnLoading.value = true;
    await manager.startExport('markdown');
  } catch (error) {
    console.error('导出任务失败:', error);
    alert((error as Error).message);
  } finally {
    exportBtnLoading.value = false;
  }
}

// 导出 word
async function export2word() {
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    showToast('提示', '请先选择文章');
    return;
  }

  const urls: string[] = selectedRows.map(article => article.link);

  const manager = new Exporter(urls);
  manager.on('export:begin', () => {
    exportPhase.value = '资源解析中';
    progress_1.value = 0;
    progress_2.value = 0;
  });
  manager.on('export:total', (total: number) => {
    exportPhase.value = '导出中';
    progress_1.value = 0;
    progress_2.value = total;
  });
  manager.on('export:progress', (index: number) => {
    progress_1.value = index;
  });
  manager.on('export:finish', (seconds: number) => {
    console.debug('耗时:', formatElapsedTime(seconds));
    toast.add({
      id: 'update_downloaded',
      color: 'purple',
      title: 'Word 导出完成',
      description: `本次导出耗时 ${formatElapsedTime(seconds)}`,
      icon: 'i-octicon-desktop-download-24',
    });
  });

  try {
    exportBtnLoading.value = true;
    await manager.startExport('word');
  } catch (error) {
    console.error('导出任务失败:', error);
    alert((error as Error).message);
  } finally {
    exportBtnLoading.value = false;
  }
}

async function debug() {
  const article = await getArticleByLink('https://mp.weixin.qq.com/s/8sCrH6AZyyff5dVXQAzVFQ');
  console.log(article);
}
</script>

<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">文章下载</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部筛选与操作区 -->
      <header class="flex flex-col items-start 2xl:flex-row 2xl:items-center gap-2 2xl:justify-between px-3 py-2">
        <div class="flex flex-col xl:flex-row gap-2">
          <div class="flex space-x-3">
            <AccountSelectorForArticle v-model="selectedAccount" class="w-80" />
          </div>
        </div>
        <div class="flex items-center space-x-2">
          <ButtonGroup
            :items="[
              { label: '文章内容', event: 'download-article-html' },
              { label: '阅读量 (需要Credential)', event: 'download-article-metadata' },
              { label: '留言内容 (需要Credential)', event: 'download-article-comment' },
            ]"
            @download-article-html="downloadArticleHTML"
            @download-article-metadata="downloadArticleMetadata"
            @download-article-comment="downloadArticleComment"
          >
            <UButton
              :loading="downloadBtnLoading"
              :disabled="!selectedAccount"
              color="white"
              class="font-mono"
              :label="downloadBtnLoading ? `抓取中 ${progress_1}/${progress_2}` : '抓取'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>
          <ButtonGroup
            :items="[
              { label: 'Excel', event: 'export-article-excel' },
              { label: 'JSON', event: 'export-article-json' },
              { label: 'HTML', event: 'export-article-html' },
              { label: 'Txt', event: 'export-article-txt' },
              { label: 'Markdown', event: 'export-article-markdown' },
              { label: 'Word (内测中)', event: 'export-article-word' },
              // { label: 'PDF (计划中)', event: 'export-article-pdf', disabled: true },
            ]"
            @export-article-excel="export2excel"
            @export-article-json="export2json"
            @export-article-html="export2html"
            @export-article-txt="export2txt"
            @export-article-markdown="export2markdown"
            @export-article-word="export2word"
          >
            <UButton
              :loading="exportBtnLoading"
              :disabled="!selectedAccount"
              color="white"
              class="font-mono"
              :label="exportBtnLoading ? `${exportPhase} ${progress_1}/${progress_2}` : '导出'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>
          <UButton v-if="isDev" @click="debug">调试</UButton>
        </div>
      </header>

      <ag-grid-vue
        style="width: 100%; height: 100%"
        :loading="loading"
        :rowData="globalRowData"
        :columnDefs="columnDefs"
        :gridOptions="gridOptions"
        @grid-ready="onGridReady"
        @filter-changed="onFilterChanged"
        @column-moved="onColumnStateChange"
        @column-visible="onColumnStateChange"
        @column-pinned="onColumnStateChange"
        @column-resized="onColumnStateChange"
      ></ag-grid-vue>
    </div>

    <PreviewArticle ref="previewArticleRef" />
  </div>
</template>
