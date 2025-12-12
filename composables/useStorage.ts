/**
 * 存储后端选择 composable
 * 根据配置返回适当的存储适配器
 */

import { getStorageAdapter } from '~/store/v3/adapter';

// 判断是否使用 MySQL 后端
export function useStorageBackend() {
    const config = useRuntimeConfig();
    const useMysql = config.public.useMysql === true;

    return {
        useMysql,
        adapter: useMysql ? getStorageAdapter() : null,
    };
}

// 导出存储适配器获取函数
export function getStorage() {
    const config = useRuntimeConfig();
    if (config.public.useMysql === true) {
        return getStorageAdapter();
    }
    return null;
}
