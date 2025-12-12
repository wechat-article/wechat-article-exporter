/**
 * 存储层 v3 - 统一入口
 * 提供 MySQL 存储适配器及 v2 兼容的 API
 */

// 导出 v2 兼容的便捷函数
export * from './bridge';

// 导出适配器类
export { getStorageAdapter, MySQLAdapter } from './adapter';
export type { StorageAdapter } from './adapter';
export type * from './types';
