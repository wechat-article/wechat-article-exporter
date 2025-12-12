import { db } from './db';
import { useMySQLBackend } from './index';

export interface HtmlAsset {
  fakeid: string;
  url: string;
  file: Blob;
  title: string;
  commentID: string | null;
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
function base64ToBlob(base64: string, type: string = 'text/html'): Blob {
  const byteCharacters = atob(base64.split(',')[1] || base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type });
}

/**
 * 更新 html 缓存
 * @param html 缓存
 */
export async function updateHtmlCache(html: HtmlAsset): Promise<boolean> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    const htmlData = {
      ...html,
      file: await blobToBase64(html.file),
    };
    await $fetch('/api/db/data', {
      method: 'POST',
      body: { table: 'html', action: 'set', data: htmlData },
    });
    return true;
  }

  return db.transaction('rw', 'html', () => {
    db.html.put(html);
    return true;
  });
}

/**
 * 获取 asset 缓存
 * @param url
 */
export async function getHtmlCache(url: string): Promise<HtmlAsset | undefined> {
  // 如果使用 MySQL，调用 REST API
  if (useMySQLBackend()) {
    try {
      const result = await $fetch<{ code: number; data: any }>('/api/db/data', {
        method: 'POST',
        body: { table: 'html', action: 'get', key: url },
      });
      if (result.code !== 0 || !result.data) return undefined;
      return {
        ...result.data,
        file: base64ToBlob(result.data.file, 'text/html'),
      };
    } catch {
      return undefined;
    }
  }

  return db.html.get(url);
}

/**
 * 批量检查 URL 是否已下载 HTML
 * 返回已存在的 URL 列表
 */
export async function checkHtmlExistsBatch(urls: string[]): Promise<string[]> {
  if (!useMySQLBackend()) {
    // IndexedDB 模式：逐个检查
    const existingUrls: string[] = [];
    for (const url of urls) {
      const cached = await db.html.get(url);
      if (cached) existingUrls.push(url);
    }
    return existingUrls;
  }

  // MySQL 模式：批量 API
  try {
    const result = await $fetch<{ code: number; data: string[] }>('/api/db/html/batch-check', {
      method: 'POST',
      body: { urls },
    });
    if (result.code !== 0) return [];
    return result.data;
  } catch {
    return [];
  }
}

/**
 * 批量获取多个 URL 的 HTML 内容
 * 返回 URL -> HtmlAsset 的 Map
 */
export async function getHtmlBatch(urls: string[]): Promise<Map<string, HtmlAsset>> {
  const result = new Map<string, HtmlAsset>();
  if (urls.length === 0) return result;

  if (!useMySQLBackend()) {
    // IndexedDB 模式：逐个获取
    for (const url of urls) {
      const cached = await db.html.get(url);
      if (cached) result.set(url, cached);
    }
    return result;
  }

  // MySQL 模式：批量 API
  try {
    const response = await $fetch<{ code: number; data: Record<string, any> }>('/api/db/html/batch-get', {
      method: 'POST',
      body: { urls },
    });
    if (response.code !== 0) return result;

    for (const [url, data] of Object.entries(response.data)) {
      result.set(url, {
        ...data,
        file: base64ToBlob(data.file, 'text/html'),
      });
    }
    return result;
  } catch {
    return result;
  }
}

