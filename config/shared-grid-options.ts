import { AG_GRID_LOCALE_CN } from '@ag-grid-community/locale';
import { type GridOptions, themeQuartz } from 'ag-grid-community';
import GridLoading from '~/components/grid/Loading.vue';
import GridNoRows from '~/components/grid/NoRows.vue';

// 创建自定义的中文本地化，覆盖 columns 键
const customLocaleText = {
  ...AG_GRID_LOCALE_CN,
  columns: '配置字段',
};

const isCompactGridViewport =
  import.meta.client && (window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth < 768);

const sharedGridSideBar: GridOptions['sideBar'] = isCompactGridViewport
  ? false
  : {
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
    };

/**
 * Grid表格公共配置
 */
export const sharedGridOptions: GridOptions = {
  localeText: customLocaleText,
  rowNumbers: {
    resizable: true,
    minWidth: isCompactGridViewport ? 48 : 80,
    maxWidth: isCompactGridViewport ? 64 : 120,
  },
  loadingOverlayComponent: GridLoading,
  noRowsOverlayComponent: GridNoRows,
  sideBar: sharedGridSideBar,
  enableCellTextSelection: true,
  tooltipShowDelay: 0,
  tooltipShowMode: 'whenTruncated',
  suppressContextMenu: true,
  defaultColDef: {
    sortable: true,
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
    width: isCompactGridViewport ? 48 : 80,
    pinned: 'left',
  },
  rowSelection: {
    mode: 'multiRow',
    headerCheckbox: true,
    selectAll: 'filtered',
  },
  theme: themeQuartz.withParams({
    accentColor: '#D75C70',
    backgroundColor: '#FDF8F6',
    borderColor: 'rgba(53, 20, 26, 0.12)',
    browserColorScheme: 'light',
    chromeBackgroundColor: '#FCF5F2',
    foregroundColor: '#35141A',
    headerBackgroundColor: '#F7EEEB',
    rowBorder: true,
    columnBorder: true,
    headerFontWeight: 700,
    headerTextColor: '#35141A',
    oddRowBackgroundColor: '#FCF5F2',
    rowHoverColor: '#F9ECEE',
    selectedRowBackgroundColor: '#F5DDE2',
    sidePanelBorder: true,
    wrapperBorderRadius: 0,
    fontFamily:
      '"Avenir Next", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", system-ui, sans-serif',
    headerFontFamily: '"Avenir Next", "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif',
    fontSize: 14,
  }),
};
