import dayjs, { Dayjs } from 'dayjs';
import { MP_ORIGIN_TIMESTAMP } from '~/config';
import type { Preferences } from '~/types/preferences';

export default () => {
  const preferences = usePreferences();

  function getDeadline(): Dayjs {
    const syncDateRange = (preferences.value as unknown as Preferences).syncDateRange;
    const syncDatePoint = (preferences.value as unknown as Preferences).syncDatePoint;

    const start = dayjs().add(1, 'days').startOf('day');
    switch (syncDateRange) {
      case '1d':
        return start.subtract(1, 'days');
      case '3d':
        return start.subtract(3, 'days');
      case '7d':
        return start.subtract(7, 'days');
      case '15d':
        return start.subtract(15, 'days');
      case '1m':
        return start.subtract(1, 'months');
      case '3m':
        return start.subtract(3, 'months');
      case '6m':
        return start.subtract(6, 'months');
      case '1y':
        return start.subtract(1, 'years');
      case 'point':
        // 指定绝对时间
        if (syncDatePoint === 0) {
          // 等价于all
          return dayjs.unix(MP_ORIGIN_TIMESTAMP);
        } else {
          return dayjs.unix(syncDatePoint);
        }
      case 'all':
      default:
        return dayjs.unix(MP_ORIGIN_TIMESTAMP);
    }
  }

  /**
   * 获取文章同步的截止时间戳
   *
   * @description 该时间戳会与文章的发布时间(create_time)进行比对，若文章的发布时间早于该值，则不再继续同步该公众号
   */
  function getSyncTimestamp() {
    return getDeadline().unix();
  }

  function getActualDateRange() {
    const now = dayjs().format('YYYY-MM-DD');
    const deadline = getDeadline();

    return deadline.format('YYYY-MM-DD') + ' ~ ' + now;
  }

  /**
   * 获取同步范围设置项
   */
  function getSelectOptions() {
    return [
      {
        value: '1d',
        label: '最近一天',
      },
      {
        value: '3d',
        label: '最近三天',
      },
      {
        value: '7d',
        label: '最近七天',
      },
      {
        value: '15d',
        label: '最近半个月',
      },
      {
        value: '1m',
        label: '最近一个月',
      },
      {
        value: '3m',
        label: '最近三个月',
      },
      {
        value: '6m',
        label: '最近半年',
      },
      {
        value: '1y',
        label: '最近一年',
      },
      {
        value: 'all',
        label: '全部',
      },
      {
        value: 'point',
        label: '自定义时间',
      },
    ];
  }

  return {
    getSyncTimestamp,
    getActualDateRange,
    getSelectOptions,
  };
};
