import { AG_GRID_LOCALE_CN } from '@ag-grid-community/locale';
import { type GridOptions, themeQuartz } from 'ag-grid-community';
import GridLoading from '~/components/grid/Loading.vue';
import GridNoRows from '~/components/grid/NoRows.vue';

// 创建自定义的中文本地化，覆盖 columns 键
const customLocaleText = {
  ...AG_GRID_LOCALE_CN,
  columns: '配置字段',
};

/**
 * Grid表格公共配置
 */
export const sharedGridOptions: GridOptions = {
  localeText: customLocaleText,
  rowNumbers: {
    resizable: true,
    minWidth: 80,
    maxWidth: 120,
  },
  loadingOverlayComponent: GridLoading,
  noRowsOverlayComponent: GridNoRows,
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
    fontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "WenQuanYi Micro Hei", system-ui, sans-serif', // 优先使用常见中文字体
    headerFontFamily: '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, sans-serif', // 表头也同步优化（可选）
    fontSize: 14, // 默认通常是 13-14px，可适当增大到 15 或 16，让文字更舒展
    // cellHorizontalPadding: 36, // 默认约 12px，增大可给单元格文字更多水平空间，缓解密集感
  }),
};
