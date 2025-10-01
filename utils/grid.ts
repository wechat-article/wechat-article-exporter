import type {
  IDateFilterParams,
  ISetFilterParams,
  ITextFilterParams,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import type { Article } from '~/types/article';

// 布尔类型的列过滤参数
export function createBooleanColumnFilterParams(trueLabel: string, falseLabel: string): ISetFilterParams<any, boolean> {
  const map: Map<boolean, string> = new Map<boolean, string>();
  map.set(true, trueLabel);
  map.set(false, falseLabel);

  return {
    suppressMiniFilter: true,
    values: [true, false],
    valueFormatter: (params: ValueFormatterParams) => map.get(params.value) ?? '',
  };
}

// 日期类型的列过滤参数
export function createDateColumnFilterParams(): IDateFilterParams {
  return {
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
}

// 文本类型的列过滤参数
export function createTextColumnFilterParams(): ITextFilterParams {
  return {
    filterOptions: ['contains', 'notContains'],
    maxNumConditions: 1,
  };
}

// 数字类型的 ValueGetter
export function createNumberValueGetter(field: keyof Article) {
  return (params: ValueGetterParams<Article>) => {
    if (params.node?.group) {
      return params.node.childrenAfterFilter?.reduce((acc, row) => acc + ((row.data![field] as number) || 0), 0);
    } else {
      return params.data && params.data[field];
    }
  };
}

// 布尔类型的 ValueGetter
export function createBooleanValueGetter(field: keyof Article) {
  return (params: ValueGetterParams<Article>) => {
    if (params.node?.group) {
      const total = params.node.childrenAfterFilter?.length || 0;
      const count = params.node.childrenAfterFilter?.filter(row => row.data![field]).length || 0;
      return `${count}/${total}`;
    } else {
      return params.data && params.data[field];
    }
  };
}
