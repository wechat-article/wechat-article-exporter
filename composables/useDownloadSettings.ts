/**
 * 合集下载相关的用户偏好设置(持久化到 localStorage)。
 * 目前仅包含「分包大小」一项，后续可扩展重试次数等配置。
 */

/**
 * 持久化设置在 localStorage 中的 key。
 */
const SETTINGS_KEY = 'album-download-settings';

/**
 * 默认每个分包包含的文章数量。
 */
export const DEFAULT_CHUNK_SIZE = 50;

/**
 * 分包大小允许的最小值与最大值，避免用户输入极端值导致内存再次溢出或请求过于频繁。
 */
export const MIN_CHUNK_SIZE = 1;
export const MAX_CHUNK_SIZE = 200;

interface DownloadSettings {
  // 每个分包包含的文章数
  chunkSize: number;
}

function clampChunkSize(value: number): number {
  if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
    return DEFAULT_CHUNK_SIZE;
  }
  return Math.max(MIN_CHUNK_SIZE, Math.min(MAX_CHUNK_SIZE, Math.floor(value)));
}

function loadSettings(): DownloadSettings {
  // SSR 阶段 localStorage 不可用，直接返回默认值
  if (typeof localStorage === 'undefined') {
    return { chunkSize: DEFAULT_CHUNK_SIZE };
  }
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { chunkSize: DEFAULT_CHUNK_SIZE };
    const parsed = JSON.parse(raw) as Partial<DownloadSettings>;
    return { chunkSize: clampChunkSize(parsed.chunkSize ?? DEFAULT_CHUNK_SIZE) };
  } catch {
    return { chunkSize: DEFAULT_CHUNK_SIZE };
  }
}

export function useDownloadSettings() {
  const chunkSize = ref(loadSettings().chunkSize);

  function persist() {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ chunkSize: chunkSize.value }));
    } catch (e) {
      console.warn('保存下载设置失败', e);
    }
  }

  /**
   * 更新并持久化分包大小。会自动 clamp 到允许区间内。
   */
  function setChunkSize(value: number) {
    chunkSize.value = clampChunkSize(value);
    persist();
  }

  return {
    chunkSize,
    setChunkSize,
    defaultChunkSize: DEFAULT_CHUNK_SIZE,
    minChunkSize: MIN_CHUNK_SIZE,
    maxChunkSize: MAX_CHUNK_SIZE,
  };
}
