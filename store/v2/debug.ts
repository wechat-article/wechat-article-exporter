import { db } from './db';
import { useMySQLBackend } from './index';

export interface DebugAsset {
  type: string;
  url: string;
  file: Blob;
  title: string;
  fakeid: string;
}

// Blob 转 Base64
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Base64 转 Blob
function base64ToBlob(base64: string, type: string = 'application/octet-stream'): Blob {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
}

/**
 * 更新 debug 缓存
 * @param debug 缓存
 */
export async function updateDebugCache(debug: DebugAsset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    const debugData = {
      ...debug,
      file: await blobToBase64(debug.file),
    };
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'debug', action: 'set', data: debugData },
    });
    return true;
  }

  return db.transaction('rw', 'debug', () => {
    db.debug.put(debug);
    return true;
  });
}

/**
 * 获取 debug 缓存
 * @param url
 */
export async function getDebugCache(url: string): Promise<DebugAsset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: any }>('/api/db/data', {
        method: 'POST',
        body: { table: 'debug', action: 'get', key: url },
      });
      if (result.code !== 0 || !result.data) return undefined;
      return {
        ...result.data,
        file: base64ToBlob(result.data.file),
      };
    } catch {
      return undefined;
    }
  }

  return db.debug.get(url);
}

export async function getDebugInfo(): Promise<DebugAsset[]> {
  // 如果使用 MySQL，暂不支持批量获取
  if (useMySQLBackend()) {
    return [];
  }

  return db.debug.toArray();
}
