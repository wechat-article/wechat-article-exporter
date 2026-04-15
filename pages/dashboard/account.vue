<script setup lang="ts">
import type {
  ColDef,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ICellRendererParams,
  SelectionChangedEvent,
  ValueGetterParams,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import { defu } from 'defu';
import { formatTimeStamp } from '#shared/utils/helpers';
import GlobalSearchAccountDialog from '~/components/global/SearchAccountDialog.vue';
import GridAccountActions from '~/components/grid/AccountActions.vue';
import GridLoadProgress from '~/components/grid/LoadProgress.vue';
import ConfirmModal from '~/components/modal/Confirm.vue';
import LoginModal from '~/components/modal/Login.vue';
import toastFactory from '~/composables/toast';
import useLoginCheck from '~/composables/useLoginCheck';
import { IMAGE_PROXY, websiteName } from '~/config';
import { sharedGridOptions } from '~/config/shared-grid-options';
import { getAccountSyncStatusLabel } from '~/shared/utils/account-sync-status';
import { deleteAccountData } from '~/store/v2';
import { getAllInfo, importMpAccounts, type MpAccount } from '~/store/v2/info';
import type { AccountManifest } from '~/types/account';
import { exportAccountJsonFile } from '~/utils/exporter';
import { createBooleanColumnFilterParams, createDateColumnFilterParams } from '~/utils/grid';

useHead({
  title: `公众号管理 | ${websiteName}`,
});

type ManualSyncStage = 'queued' | 'syncing' | 'exporting' | 'finalizing' | 'completed' | 'failed' | 'cancelled' | 'cancelling';

interface ManualSyncJobStatus {
  jobId: string;
  fakeid: string;
  nickname: string;
  stage: ManualSyncStage;
  syncToTimestamp: number;
  startedAt: number;
  updatedAt: number;
  cancelRequested: boolean;
  pageNumber: number;
  begin: number;
  totalCount: number;
  currentPageArticleCount: number;
  currentPageFilteredCount: number;
  currentArticleTitle: string | null;
  currentArticleUrl: string | null;
  currentArticleIndex: number;
  currentArticleTotal: number;
  retrying: boolean;
  retryMessage: string | null;
  articleCount: number;
  generated: number;
  skipped: number;
  failed: number;
  failedUrls: string[];
  error?: string;
}

type AccountGridRow = MpAccount & {
  manualSyncJob?: ManualSyncJobStatus | null;
};

const toast = toastFactory();
const modal = useModal();
const { checkLogin } = useLoginCheck();

const { getSyncTimestamp, getSyncRangeLabel, getActualDateRange, isSyncAll } = useSyncDeadline();
// syncToTimestamp 在每次同步时重新计算，确保使用最新的时间范围配置
let syncToTimestamp = getSyncTimestamp();

const ACCOUNT_PAGE_REFRESH_INTERVAL_MS = 30000;
const MANUAL_SYNC_STATUS_POLL_INTERVAL_MS = 3000;

// 账号事件总线，用于和 Credentials 面板保持列表同步
const { accountEventBus } = useAccountEventBus();
accountEventBus.on(event => {
  if (event === 'account-added' || event === 'account-removed') {
    refresh();
  }
});

const searchAccountDialogRef = ref<typeof GlobalSearchAccountDialog | null>(null);

const addBtnLoading = ref(false);
const manualSyncJobs = ref<Record<string, ManualSyncJobStatus>>({});
const manualSyncWaiters = new Map<string, (status: ManualSyncJobStatus) => void>();
let manualSyncStatusTimer: number | null = null;
let isPollingManualSyncJobs = false;
let isRefreshingAccounts = false;

function addAccount() {
  if (!checkLogin()) return;

  searchAccountDialogRef.value!.open();
}
async function onSelectAccount(account: MpAccount) {
  addBtnLoading.value = true;
  await importMpAccounts([account]);
  await refresh();
  addBtnLoading.value = false;
  toast.success('公众号添加成功', `已成功添加公众号【${account.nickname}】，请手动点击同步按钮获取文章数据`);
  // 通知 Credentials 面板按钮立即变更为“已添加”
  accountEventBus.emit('account-added', { fakeid: account.fakeid });
}

// 表示同步过程中是否执行了取消操作
const isDeleting = ref(false);
let refreshTimer: number | null = null;

function sleep(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function isTerminalSyncStage(stage: ManualSyncStage) {
  return stage === 'completed' || stage === 'failed' || stage === 'cancelled';
}

async function startManualSyncRequest(account: MpAccount) {
  return await $fetch<{ jobId: string; status: ManualSyncJobStatus }>('/api/web/worker/manual-sync', {
    method: 'POST',
    body: {
      fakeid: account.fakeid,
      nickname: account.nickname,
      roundHeadImg: account.round_head_img,
      syncToTimestamp,
    },
  });
}

async function getManualSyncStatus(jobId?: string) {
  return await $fetch<ManualSyncJobStatus>('/api/web/worker/manual-sync-status', jobId
    ? {
        query: { jobId },
      }
    : undefined);
}

async function getManualSyncStatuses(jobIds?: string[]) {
  return await $fetch<ManualSyncJobStatus[]>('/api/web/worker/manual-sync-status', {
    query: jobIds && jobIds.length > 0
      ? { jobIds: jobIds.join(',') }
      : { all: '1' },
  });
}

function getTrackedManualSyncJob(fakeid: string): ManualSyncJobStatus | null {
  const jobs = Object.values(manualSyncJobs.value)
    .filter(job => job.fakeid === fakeid && !isTerminalSyncStage(job.stage))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  return jobs[0] || null;
}

function mergeGridRows(rows: MpAccount[]): AccountGridRow[] {
  return rows.map(row => ({
    ...row,
    manualSyncJob: getTrackedManualSyncJob(row.fakeid),
  }));
}

function applyGridRows(rows: MpAccount[]) {
  globalRowData = mergeGridRows(rows);
  gridApi.value?.setGridOption('rowData', globalRowData);
}

function patchGridRowsWithManualSyncJobs() {
  globalRowData = globalRowData.map(row => ({
    ...row,
    manualSyncJob: getTrackedManualSyncJob(row.fakeid),
  }));
  gridApi.value?.setGridOption('rowData', globalRowData);
}

function trackManualSyncJob(status: ManualSyncJobStatus) {
  manualSyncJobs.value = {
    ...manualSyncJobs.value,
    [status.jobId]: status,
  };
  patchGridRowsWithManualSyncJobs();
}

function removeTrackedManualSyncJob(jobId: string) {
  if (!manualSyncJobs.value[jobId]) {
    return;
  }

  const nextJobs = { ...manualSyncJobs.value };
  delete nextJobs[jobId];
  manualSyncJobs.value = nextJobs;
  patchGridRowsWithManualSyncJobs();
}

function resolveManualSyncWaiter(status: ManualSyncJobStatus) {
  const waiter = manualSyncWaiters.get(status.jobId);
  if (!waiter) {
    return;
  }

  manualSyncWaiters.delete(status.jobId);
  waiter(status);
}

function activeTrackedManualSyncJobIds() {
  return Object.values(manualSyncJobs.value)
    .filter(job => !isTerminalSyncStage(job.stage))
    .map(job => job.jobId);
}

function hasActiveManualSyncJobs() {
  return activeTrackedManualSyncJobIds().length > 0;
}

function stopManualSyncStatusPolling() {
  if (manualSyncStatusTimer) {
    window.clearInterval(manualSyncStatusTimer);
    manualSyncStatusTimer = null;
  }
}

async function pollManualSyncStatuses() {
  const jobIds = activeTrackedManualSyncJobIds();
  if (jobIds.length === 0 || isPollingManualSyncJobs) {
    if (jobIds.length === 0) {
      stopManualSyncStatusPolling();
    }
    return;
  }

  isPollingManualSyncJobs = true;
  try {
    const statuses = await getManualSyncStatuses(jobIds);
    if (statuses.length === 0) {
      return;
    }

    let shouldRefreshAccounts = false;
    for (const status of statuses) {
      trackManualSyncJob(status);
      if (isTerminalSyncStage(status.stage)) {
        shouldRefreshAccounts = true;
        resolveManualSyncWaiter(status);
        removeTrackedManualSyncJob(status.jobId);
      }
    }

    if (shouldRefreshAccounts) {
      await refresh();
    }
  } catch (error) {
    console.error('轮询手动同步状态失败:', error);
  } finally {
    isPollingManualSyncJobs = false;
    if (!hasActiveManualSyncJobs()) {
      stopManualSyncStatusPolling();
    }
  }
}

function ensureManualSyncStatusPolling() {
  if (manualSyncStatusTimer) {
    return;
  }

  void pollManualSyncStatuses();
  manualSyncStatusTimer = window.setInterval(() => {
    void pollManualSyncStatuses();
  }, MANUAL_SYNC_STATUS_POLL_INTERVAL_MS);
}

async function hydrateManualSyncJobs() {
  try {
    const statuses = await getManualSyncStatuses();
    if (statuses.length === 0) {
      return;
    }

    const nextJobs: Record<string, ManualSyncJobStatus> = {};
    for (const status of statuses) {
      nextJobs[status.jobId] = status;
    }
    manualSyncJobs.value = nextJobs;
    patchGridRowsWithManualSyncJobs();
    ensureManualSyncStatusPolling();
  } catch (error) {
    console.error('初始化手动同步状态失败:', error);
  }
}

async function waitForManualSyncJob(jobId: string) {
  const trackedStatus = manualSyncJobs.value[jobId];
  if (trackedStatus && isTerminalSyncStage(trackedStatus.stage)) {
    return trackedStatus;
  }

  ensureManualSyncStatusPolling();
  return await new Promise<ManualSyncJobStatus>((resolve) => {
    manualSyncWaiters.set(jobId, resolve);
  });
}

async function cancelManualSyncJob(job: ManualSyncJobStatus) {
  const status = await $fetch<ManualSyncJobStatus>('/api/web/worker/manual-sync-cancel', {
    method: 'POST',
    body: { jobId: job.jobId },
  });
  trackManualSyncJob(status);
  ensureManualSyncStatusPolling();
}

async function loadAccountArticle(account: MpAccount) {
  syncToTimestamp = getSyncTimestamp();
  console.log(
    `[sync] 开始同步【${account.nickname}】，` +
    `同步范围: ${getSyncRangeLabel()}，` +
    `时间区间: ${getActualDateRange()}`
  );

  try {
    const { jobId, status } = await startManualSyncRequest(account);
    trackManualSyncJob(status);
    ensureManualSyncStatusPolling();

    const finalStatus = await waitForManualSyncJob(jobId);
    await refresh();
    removeTrackedManualSyncJob(jobId);

    if (finalStatus.stage === 'cancelled') {
      throw new Error('已取消同步');
    }

    if (finalStatus.stage === 'failed') {
      if (finalStatus.error === 'session expired' || finalStatus.error?.includes('未登录')) {
        modal.open(LoginModal);
      }
      throw new Error(finalStatus.error || '同步失败');
    }

    return finalStatus;
  } catch (error: any) {
    if (error?.data?.message) {
      throw new Error(error.data.message);
    }
    if (error?.message === 'session expired') {
      modal.open(LoginModal);
    }
    throw error;
  }
}

// 同步所有公众号
async function loadSelectedAccountArticle() {
  if (!checkLogin()) return;

  const rows = getSelectedRows();
  const activeRows = rows.filter(account => !account.is_delete);
  const skippedDisabled = rows.length - activeRows.length;

  if (activeRows.length === 0) {
    toast.warning('无法同步', '选中的公众号都已禁用');
    return;
  }

  try {
    syncToTimestamp = getSyncTimestamp();
    const jobRefs = [];
    for (const account of activeRows) {
      const job = await startManualSyncRequest(account);
      trackManualSyncJob(job.status);
      jobRefs.push({ account, jobId: job.jobId });
    }

    ensureManualSyncStatusPolling();

    let totalGenerated = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    const finalStatuses = await Promise.all(jobRefs.map(job => waitForManualSyncJob(job.jobId)));
    for (const status of finalStatuses) {
      totalGenerated += status.generated;
      totalSkipped += status.skipped;
      totalFailed += status.failed;

      if (status.stage === 'failed') {
        if (status.error === 'session expired' || status.error?.includes('未登录')) {
          modal.open(LoginModal);
        }
        throw new Error(status.error || '同步失败');
      }

      if (status.stage === 'cancelled') {
        throw new Error('已取消同步');
      }
    }

    await refresh();
    const rangeHint = isSyncAll() ? '' : `（同步范围：${getSyncRangeLabel()}）`;
    toast.success(
      '同步完成',
      `已成功同步 ${activeRows.length} 个公众号${rangeHint}，文档生成 ${totalGenerated} 篇，跳过 ${totalSkipped} 篇，失败 ${totalFailed} 篇`
    );
    if (skippedDisabled > 0) {
      toast.warning('已跳过禁用公众号', `本次跳过 ${skippedDisabled} 个已禁用公众号`);
    }
  } catch (e: any) {
    if (e.message === '已取消同步') {
      toast.warning('同步已取消', '当前同步任务已停止');
    } else {
      toast.error('同步失败', e.message);
    }
  }
}

let globalRowData: AccountGridRow[] = [];

const columnDefs = ref<ColDef[]>([
  {
    colId: 'fakeid',
    headerName: 'fakeid',
    field: 'fakeid',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    minWidth: 200,
    cellClass: 'font-mono',
    initialHide: true,
  },
  {
    colId: 'round_head_img',
    headerName: '头像',
    field: 'round_head_img',
    sortable: false,
    filter: false,
    cellRenderer: (params: ICellRendererParams) => {
      return `<img alt="" src="${IMAGE_PROXY + params.value}" style="height: 30px; width: 30px; object-fit: cover; border: 1px solid #e5e7eb; border-radius: 100%;" />`;
    },
    cellClass: 'flex justify-center items-center',
    minWidth: 80,
  },
  {
    colId: 'nickname',
    headerName: '名称',
    field: 'nickname',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    tooltipField: 'nickname',
    minWidth: 200,
  },
  {
    colId: 'create_time',
    headerName: '添加时间',
    field: 'create_time',
    valueFormatter: p => (p.value ? formatTimeStamp(p.value) : ''),
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('create_time') * 1000);
    },
    sort: 'desc',
    minWidth: 180,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    colId: 'update_time',
    headerName: '最后数据更新时间',
    field: 'update_time',
    valueFormatter: p => (p.value ? formatTimeStamp(p.value) : ''),
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('update_time') * 1000);
    },
    minWidth: 180,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    colId: 'total_count',
    headerName: '消息总数',
    field: 'total_count',
    cellDataType: 'number',
    cellRenderer: 'agAnimateShowChangeCellRenderer',
    filter: 'agNumberColumnFilter',
    cellClass: 'flex justify-center items-center font-mono',
    minWidth: 150,
  },
  {
    colId: 'count',
    headerName: '已同步消息数',
    field: 'count',
    cellDataType: 'number',
    cellRenderer: 'agAnimateShowChangeCellRenderer',
    filter: 'agNumberColumnFilter',
    cellClass: 'flex justify-center items-center font-mono',
    minWidth: 180,
  },
  {
    colId: 'articles',
    headerName: '已同步文章数',
    field: 'articles',
    cellDataType: 'number',
    cellRenderer: 'agAnimateShowChangeCellRenderer',
    filter: 'agNumberColumnFilter',
    cellClass: 'flex justify-center items-center font-mono',
    minWidth: 180,
    initialHide: true,
  },
  {
    colId: 'status',
    headerName: '同步状态',
    field: 'status',
    cellRenderer: (params: ICellRendererParams) => {
      const label = getAccountSyncStatusLabel(params.value);
      return label ? `<span class="inline-flex items-center justify-center whitespace-nowrap">${label}</span>` : '';
    },
    tooltipValueGetter: () => null,
    filter: 'agSetColumnFilter',
    minWidth: 140,
    cellClass: 'flex justify-center items-center',
  },
  {
    colId: 'is_interface',
    headerName: '接口添加',
    field: 'is_interface',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('接口添加', '页面添加'),
    cellClass: 'flex justify-center items-center',
    headerClass: 'justify-center',
    minWidth: 140,
  },
  {
    colId: 'is_delete',
    headerName: '是否禁用',
    field: 'is_delete',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已禁用', '未禁用'),
    cellClass: 'flex justify-center items-center',
    headerClass: 'justify-center',
    minWidth: 140,
  },
  {
    colId: 'load_percent',
    headerName: '同步进度',
    valueGetter: params => (params.data.total_count === 0 ? 0 : params.data.count / params.data.total_count),
    cellDataType: 'number',
    cellRenderer: GridLoadProgress,
    filter: 'agNumberColumnFilter',
    minWidth: 260,
  },
  {
    colId: 'completed',
    headerName: '是否同步完成',
    field: 'completed',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已同步完成', '未同步完成'),
    cellClass: 'flex justify-center items-center',
    headerClass: 'justify-center',
    minWidth: 200,
  },
  {
    colId: 'action',
    headerName: '操作',
    field: 'fakeid',
    sortable: false,
    filter: false,
    cellRenderer: GridAccountActions,
    cellRendererParams: {
      onSync: (params: ICellRendererParams) => {
        if (!checkLogin()) return;

        loadAccountArticle(params.data)
          .then((status) => {
            const rangeHint = isSyncAll() ? '' : `（同步范围：${getSyncRangeLabel()}）`;
            const exportSummary = `生成 ${status.generated} 篇，跳过 ${status.skipped} 篇，失败 ${status.failed} 篇`;
            toast.success('同步完成', `公众号【${params.data.nickname}】已同步完毕${rangeHint}，${exportSummary}`);
          })
          .catch(e => {
            if (e.message === '已取消同步') {
              toast.warning('同步已取消', `公众号【${params.data.nickname}】的同步任务已停止`);
            } else {
              toast.error('同步失败', e.message);
            }
          });
      },
      onCancelSync: (params: ICellRendererParams) => {
        const job = (params.data as AccountGridRow).manualSyncJob;
        if (!job) return;

        cancelManualSyncJob(job).catch((error: any) => {
          toast.error('取消同步失败', error?.data?.message || error?.message || '取消同步失败');
        });
      },
      isDeleting: isDeleting,
    },
    cellClass: 'flex justify-center items-center',
    minWidth: 140,
    maxWidth: 160,
    pinned: 'right',
  },
]);

// 注意，`defu`函数最左边的参数优先级最高
const gridOptions: GridOptions = defu(
  {
    getRowId: (params: GetRowIdParams) => String(params.data.fakeid),
  },
  sharedGridOptions
);

const gridApi = shallowRef<GridApi | null>(null);
function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;

  restoreColumnState();
  void refresh();
  void hydrateManualSyncJobs();
  if (!refreshTimer) {
    refreshTimer = window.setInterval(() => {
      if (!hasActiveManualSyncJobs()) {
        void refresh();
      }
    }, ACCOUNT_PAGE_REFRESH_INTERVAL_MS);
  }
}

onUnmounted(() => {
  if (refreshTimer) {
    window.clearInterval(refreshTimer);
    refreshTimer = null;
  }
  stopManualSyncStatusPolling();
});

function onColumnStateChange() {
  if (gridApi.value) {
    saveColumnState();
  }
}
function saveColumnState() {
  const state = gridApi.value?.getColumnState();
  localStorage.setItem('agGridColumnState-account', JSON.stringify(state));
}

function restoreColumnState() {
  const stateStr = localStorage.getItem('agGridColumnState-account');
  if (stateStr) {
    const state = JSON.parse(stateStr);
    gridApi.value?.applyColumnState({
      state,
      applyOrder: true,
    });
  }
}

async function refresh() {
  if (isRefreshingAccounts) {
    return;
  }

  isRefreshingAccounts = true;
  try {
    const accounts = await getAllInfo();
    applyGridRows(accounts);
  } finally {
    isRefreshingAccounts = false;
  }
}

// 当前是否有选中的行
const hasSelectedRows = ref(false);
function onSelectionChanged(evt: SelectionChangedEvent) {
  hasSelectedRows.value = (evt.selectedNodes?.map(node => node.data) || []).length > 0;
}
function getSelectedRows() {
  const rows: MpAccount[] = [];
  gridApi.value?.forEachNodeAfterFilterAndSort(node => {
    if (node.isSelected()) {
      const { manualSyncJob: _manualSyncJob, ...account } = node.data as AccountGridRow;
      rows.push(account);
    }
  });
  return rows;
}

// 删除所选的公众号数据
function deleteSelectedAccounts() {
  const rows = getSelectedRows();
  const ids = rows.map(info => info.fakeid);
  modal.open(ConfirmModal, {
    title: '确定要删除所选公众号的数据吗？',
    description: '删除之后，该公众号的所有数据(包括已下载的文章和留言等)都将被清空。',
    async onConfirm() {
      try {
        isDeleting.value = true;
        await deleteAccountData(ids);
        // 通知 Credentials 面板这些公众号已被移除
        ids.forEach(fakeid => accountEventBus.emit('account-removed', { fakeid: fakeid }));
      } finally {
        isDeleting.value = false;
        await refresh();
      }
    },
  });
}

// 导入公众号
const fileRef = ref<HTMLInputElement | null>(null);
const importBtnLoading = ref(false);
function importAccount() {
  fileRef.value!.click();
}
async function handleFileChange(evt: Event) {
  const files = (evt.target as HTMLInputElement).files;
  if (files && files.length > 0) {
    const file = files[0];

    try {
      importBtnLoading.value = true;

      // 解析 JSON
      const jsonData = JSON.parse(await file.text());
      if (jsonData.usefor !== 'wechat-article-exporter') {
        // 文件格式不正确
        toast.error('导入公众号失败', '导入文件格式不正确，请选择该网站导出的文件进行导入。');
        return;
      }
      const infos = jsonData.accounts;
      if (!infos || infos.length <= 0) {
        // 文件格式不正确
        toast.error('导入公众号失败', '导入文件格式不正确，请选择该网站导出的文件进行导入。');
        return;
      }

      await importMpAccounts(infos);
      await refresh();
    } catch (error) {
      console.error('导入公众号时 JSON 解析失败:', error);
      toast.error('导入公众号', (error as Error).message);
    } finally {
      importBtnLoading.value = false;
    }
  }
}

// 导出公众号
const exportBtnLoading = ref(false);
function exportAccount() {
  exportBtnLoading.value = true;
  try {
    const rows = getSelectedRows();
    const data: AccountManifest = {
      version: '1.0',
      usefor: 'wechat-article-exporter',
      accounts: rows,
    };
    exportAccountJsonFile(data, '公众号');
    toast.success('导出公众号', `成功导出了 ${rows.length} 个公众号`);
  } finally {
    exportBtnLoading.value = false;
  }
}
</script>

<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">公众号管理</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部操作区 -->
      <header class="flex items-stretch gap-3 px-3 py-3">
        <UButton icon="i-lucide:user-plus" color="blue" :disabled="isDeleting || addBtnLoading" @click="addAccount">
          {{ addBtnLoading ? '添加中...' : '添加' }}
        </UButton>
        <UButton icon="i-lucide:arrow-down-to-line" color="blue" :loading="importBtnLoading" @click="importAccount">
          批量导入
          <input ref="fileRef" type="file" accept=".json" class="hidden" @change="handleFileChange" />
        </UButton>
        <UButton
          icon="i-lucide:arrow-up-from-line"
          color="blue"
          :loading="exportBtnLoading"
          :disabled="!hasSelectedRows"
          @click="exportAccount"
        >
          批量导出
        </UButton>
        <UButton
          color="rose"
          icon="i-lucide:user-minus"
          class="disabled:opacity-35"
          :loading="isDeleting"
          :disabled="!hasSelectedRows"
          @click="deleteSelectedAccounts"
          >删除</UButton
        >
        <UButton
          color="black"
          icon="i-heroicons:arrow-path-rounded-square-20-solid"
          class="disabled:opacity-35"
          :disabled="isDeleting || !hasSelectedRows"
          @click="loadSelectedAccountArticle"
          >同步</UButton
        >
        <div class="hidden xl:flex flex-1 justify-end">
          <span class="self-end text-sm text-blue-500 font-medium">同步范围: {{ getActualDateRange() }}</span>
        </div>
      </header>

      <!-- 数据表格 -->
      <ag-grid-vue
        style="width: 100%; height: 100%"
        :rowData="globalRowData"
        :columnDefs="columnDefs"
        :gridOptions="gridOptions"
        @grid-ready="onGridReady"
        @selection-changed="onSelectionChanged"
        @column-moved="onColumnStateChange"
        @column-visible="onColumnStateChange"
        @column-pinned="onColumnStateChange"
        @column-resized="onColumnStateChange"
      ></ag-grid-vue>
    </div>

    <!-- 添加公众号弹框 -->
    <GlobalSearchAccountDialog ref="searchAccountDialogRef" @select:account="onSelectAccount" />
  </div>
</template>
