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
