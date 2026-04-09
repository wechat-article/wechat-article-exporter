import { MP_ORIGIN_TIMESTAMP } from '~/config';
import type { Preferences } from '~/types/preferences';
import { effectScope } from 'vue';

const defaultOptions: Preferences = {
  hideDeleted: true,
  privateProxyList: [],
  privateProxyAuthorization: '',
  exportConfig: {
    dirname: '${title}',
    maxlength: 0,
    exportExcelIncludeContent: true,
    exportJsonIncludeComments: true,
    exportJsonIncludeContent: true,
    exportHtmlIncludeComments: true,
  },
  downloadConfig: {
    forceDownloadContent: false,
    metadataOverrideContent: false,
  },
  accountSyncSeconds: 3,
  syncDateRange: 'all',
  syncDatePoint: MP_ORIGIN_TIMESTAMP,
};

/** 深层合并：将 defaults 中缺失的字段补充到 target 上 */
function mergeDefaults<T extends Record<string, any>>(target: T, defaults: T): T {
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (target[key] === undefined || target[key] === null) {
      target[key] = defaults[key];
    } else if (
      typeof defaults[key] === 'object' &&
      defaults[key] !== null &&
      !Array.isArray(defaults[key])
    ) {
      target[key] = mergeDefaults(target[key] as any, defaults[key] as any);
    }
  }
  return target;
}

// ============ 单例状态 ============
let _state: Ref<Preferences> | null = null;
let _loaded = false;
let _dbReady = false;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

// 使用 detached effectScope，确保 watch 不会随任何组件卸载而被停止
const _scope = effectScope(true);

/** 防抖持久化到数据库 */
function scheduleSave(data: Preferences) {
  // DB 未加载完成前不写入，防止用默认值覆盖已保存的数据
  if (!_dbReady) {
    console.log('[preferences] scheduleSave 被调用但 DB 尚未就绪，跳过保存');
    return;
  }
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    const payload = toRaw(data);
    console.log('[preferences] 即将保存到数据库，privateProxyList:', payload.privateProxyList, '完整数据:', JSON.stringify(payload).slice(0, 300));
    $fetch('/api/preferences', {
      method: 'POST',
      body: payload,
    }).then(res => {
      console.log('[preferences] 保存成功，响应:', res);
    }).catch(e => console.error('[preferences] 保存到数据库失败:', e));
  }, 500);
}

/** 从数据库加载偏好设置（只在首次调用时执行一次） */
async function loadFromDB(state: Ref<Preferences>) {
  if (_loaded) return;
  _loaded = true;
  try {
    console.log('[preferences] 开始从数据库加载...');
    const data = await $fetch<Preferences | null>('/api/preferences');
    console.log('[preferences] 数据库返回:', data);
    if (data && typeof data === 'object') {
      // 合并默认值（补充新增字段）
      const merged = mergeDefaults({ ...data }, { ...defaultOptions });
      Object.assign(state.value, merged);
      console.log('[preferences] 加载完成，privateProxyList:', state.value.privateProxyList);
    } else {
      console.log('[preferences] 数据库无记录，使用默认值');
    }
  } catch (e) {
    console.warn('[preferences] 从数据库加载失败，使用默认值:', e);
  } finally {
    // 标记 DB 加载完成，此后的变更才会写入数据库
    _dbReady = true;
    console.log('[preferences] _dbReady = true，后续变更将自动保存');
  }
}

export default (): Ref<Preferences> => {
  if (!_state) {
    // 用默认值初始化响应式状态
    _state = ref(JSON.parse(JSON.stringify(defaultOptions))) as Ref<Preferences>;

    // 异步从 DB 加载（会覆盖默认值）
    loadFromDB(_state);

    // 在 detached scope 中监听变化，确保不随组件卸载而停止
    _scope.run(() => {
      watch(_state!, (val) => {
        console.log('[preferences] watch 触发，_dbReady:', _dbReady, 'privateProxyList:', toRaw(val).privateProxyList);
        scheduleSave(toRaw(val));
      }, { deep: true });
    });
  }

  //@ts-ignore
  return _state;
};
