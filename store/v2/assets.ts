import { db } from './db';
import { useMySQLBackend } from './index';

interface Asset {
  url: string;
  file: Blob;
  fakeid: string;
}

export type { Asset };

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
 * 更新 asset 缓存
 * @param asset
 */
export async function updateAssetCache(asset: Asset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    const assetData = {
      ...asset,
      file: await blobToBase64(asset.file),
    };
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'asset', action: 'set', data: assetData },
    });
    return true;
  }

  return db.transaction('rw', 'asset', () => {
    db.asset.put(asset);
    return true;
  });
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getAssetCache(url: string): Promise<Asset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: any }>('/api/db/data', {
        method: 'POST',
        body: { table: 'asset', action: 'get', key: url },
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

  db.transaction('r', 'asset', () => { });
  return db.asset.get(url);
}
