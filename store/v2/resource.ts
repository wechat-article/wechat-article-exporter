import { db } from './db';
import { useMySQLBackend } from './index';

export interface ResourceAsset {
  fakeid: string;
  url: string;
  file: Blob;
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
 * 更新 resource 缓存
 * @param resource 缓存
 */
export async function updateResourceCache(resource: ResourceAsset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    const resourceData = {
      ...resource,
      file: await blobToBase64(resource.file),
    };
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'resource', action: 'set', data: resourceData },
    });
    return true;
  }

  return db.transaction('rw', 'resource', () => {
    db.resource.put(resource);
    return true;
  });
}

/**
 * 获取 resource 缓存
 * @param url
 */
export async function getResourceCache(url: string): Promise<ResourceAsset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: any }>('/api/db/data', {
        method: 'POST',
        body: { table: 'resource', action: 'get', key: url },
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

  return db.resource.get(url);
}
