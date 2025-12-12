import type { AutoTaskPhase, PhaseProgress, LogEntry } from './useAutoTask';

const STORAGE_KEY = 'auto_task_state';

/**
 * 持久化状态接口
 */
export interface PersistedAutoTaskState {
    isRunning: boolean;
    isPaused: boolean;
    currentPhase: AutoTaskPhase;
    currentAccountFakeid: string | null;
    syncProgress: PhaseProgress;
    downloadProgress: PhaseProgress;
    exportProgress: PhaseProgress;
    /** 已处理的公众号 fakeid 列表（用于断点续传） */
    processedAccountIds: string[];
    /** 上次保存时间 */
    savedAt: number;
    /** 日志（最近20条） */
    logs: Array<{ time: string; level: LogEntry['level']; message: string }>;
}

/**
 * 获取默认状态
 */
function getDefaultState(): PersistedAutoTaskState {
    return {
        isRunning: false,
        isPaused: false,
        currentPhase: 'idle',
        currentAccountFakeid: null,
        syncProgress: { current: 0, total: 0 },
        downloadProgress: { current: 0, total: 0 },
        exportProgress: { current: 0, total: 0 },
        processedAccountIds: [],
        savedAt: 0,
        logs: [],
    };
}

/**
 * 从 localStorage 加载状态
 */
export function loadPersistedState(): PersistedAutoTaskState | null {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;

        const state = JSON.parse(raw) as PersistedAutoTaskState;

        // 检查状态是否过期（超过24小时视为过期）
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24小时
        if (now - state.savedAt > maxAge) {
            console.log('[AutoTaskPersistence] 持久化状态已过期，清除');
            clearPersistedState();
            return null;
        }

        return state;
    } catch (e) {
        console.error('[AutoTaskPersistence] 加载状态失败:', e);
        return null;
    }
}

/**
 * 保存状态到 localStorage
 */
export function savePersistedState(state: Partial<PersistedAutoTaskState>): void {
    try {
        const existingState = loadPersistedState() || getDefaultState();
        const newState: PersistedAutoTaskState = {
            ...existingState,
            ...state,
            savedAt: Date.now(),
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
    } catch (e) {
        console.error('[AutoTaskPersistence] 保存状态失败:', e);
    }
}

/**
 * 清除持久化状态
 */
export function clearPersistedState(): void {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error('[AutoTaskPersistence] 清除状态失败:', e);
    }
}

/**
 * 检查是否有可恢复的任务
 */
export function hasResumableTask(): boolean {
    const state = loadPersistedState();
    return state !== null && state.isRunning && !state.isPaused;
}

/**
 * 将状态标记为已暂停（用于页面卸载时）
 */
export function markAsPaused(): void {
    const state = loadPersistedState();
    if (state && state.isRunning) {
        savePersistedState({ isPaused: true });
    }
}
