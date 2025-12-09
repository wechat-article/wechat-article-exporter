/**
 * Image Uploader utility for uploading WeChat images to a custom hosting service.
 *
 * API Specification:
 * POST http://127.0.0.1:36677/upload
 * Request: { "list": ["url1", "url2", ...] }
 * Response: { "success": true, "result": ["newUrl1", "newUrl2", ...] }
 */

// Image hosting service configuration
const IMAGE_UPLOAD_API = 'http://127.0.0.1:36677/upload';
const BATCH_SIZE = 20; // Maximum images per batch request

/**
 * API response interface
 */
interface ImageUploadResponse {
    success: boolean;
    result: string[];
}

/**
 * Check if a URL is a WeChat image URL (mmbiz.qpic.cn)
 */
export function isWeChatImageUrl(url: string): boolean {
    if (!url) return false;
    try {
        // Handle both absolute URLs and protocol-relative URLs
        const normalizedUrl = url.startsWith('//') ? `https:${url}` : url;
        const parsedUrl = new URL(normalizedUrl);
        return parsedUrl.hostname === 'mmbiz.qpic.cn';
    } catch {
        return false;
    }
}

/**
 * Upload a batch of images to the hosting service
 * @param urls Array of image URLs to upload
 * @returns Promise<Map<string, string>> Map of original URL to hosted URL
 */
async function uploadBatch(urls: string[]): Promise<Map<string, string>> {
    const urlMap = new Map<string, string>();

    if (urls.length === 0) {
        return urlMap;
    }

    try {
        const response = await fetch(IMAGE_UPLOAD_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ list: urls }),
        });

        if (!response.ok) {
            console.warn(`[ImageUploader] Upload failed with status: ${response.status}`);
            // Return empty map, original URLs will be used as fallback
            return urlMap;
        }

        const data: ImageUploadResponse = await response.json();

        if (data.success && Array.isArray(data.result)) {
            // Map original URLs to new hosted URLs based on array order
            for (let i = 0; i < urls.length && i < data.result.length; i++) {
                urlMap.set(urls[i], data.result[i]);
            }
            console.log(`[ImageUploader] Successfully uploaded ${urlMap.size} images`);
        } else {
            console.warn('[ImageUploader] Upload response indicates failure:', data);
        }
    } catch (error) {
        console.error('[ImageUploader] Failed to upload images:', error);
        // Return empty map, original URLs will be used as fallback
    }

    return urlMap;
}

/**
 * Upload WeChat images to the hosting service
 * Images are processed in batches to avoid overwhelming the server
 *
 * @param urls Array of image URLs to upload (will filter for WeChat images only)
 * @returns Promise<Map<string, string>> Map of original URL to hosted URL
 */
export async function uploadImagesToHost(urls: string[]): Promise<Map<string, string>> {
    // Filter to only WeChat image URLs
    const wechatUrls = urls.filter(isWeChatImageUrl);

    if (wechatUrls.length === 0) {
        console.log('[ImageUploader] No WeChat images found to upload');
        return new Map();
    }

    // Remove duplicates
    const uniqueUrls = [...new Set(wechatUrls)];
    console.log(`[ImageUploader] Uploading ${uniqueUrls.length} WeChat images to hosting service...`);

    const resultMap = new Map<string, string>();

    // Process in batches
    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
        const batch = uniqueUrls.slice(i, i + BATCH_SIZE);
        console.log(`[ImageUploader] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(uniqueUrls.length / BATCH_SIZE)}`);

        const batchResult = await uploadBatch(batch);

        // Merge batch results
        for (const [originalUrl, hostedUrl] of batchResult) {
            resultMap.set(originalUrl, hostedUrl);
        }
    }

    console.log(`[ImageUploader] Total uploaded: ${resultMap.size}/${uniqueUrls.length} images`);
    return resultMap;
}

/**
 * Extract all image URLs from HTML content
 * @param html HTML content to parse
 * @returns Array of image URLs found in the content
 */
export function extractImageUrlsFromHtml(html: string): string[] {
    const urls: string[] = [];

    // Parse HTML and extract img src/data-src
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract from img tags
    const imgs = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));
    for (const img of imgs) {
        const src = img.getAttribute('src') || img.getAttribute('data-src');
        if (src) {
            urls.push(src);
        }
    }

    // Extract background images using regex
    const bgPattern = /(?:background|background-image):\s*url\((?:&quot;|["'])?([^)"']+)(?:&quot;|["'])?\)/gi;
    let match;
    while ((match = bgPattern.exec(html)) !== null) {
        if (match[1]) {
            urls.push(match[1]);
        }
    }

    return urls;
}

/**
 * Replace image URLs in HTML content with hosted URLs
 * @param html Original HTML content
 * @param urlMap Map of original URL to hosted URL
 * @returns HTML content with replaced URLs
 */
export function replaceImageUrlsInHtml(html: string, urlMap: Map<string, string>): string {
    if (urlMap.size === 0) {
        return html;
    }

    let result = html;

    // Replace all occurrences of original URLs with hosted URLs
    for (const [originalUrl, hostedUrl] of urlMap) {
        // Escape special regex characters in the URL
        const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedUrl, 'g');
        result = result.replace(regex, hostedUrl);
    }

    return result;
}

/**
 * Replace image URLs in DOM elements
 * @param doc Document or Element to process
 * @param urlMap Map of original URL to hosted URL
 */
export function replaceImageUrlsInDom(doc: Document | Element, urlMap: Map<string, string>): void {
    if (urlMap.size === 0) {
        return;
    }

    // Replace img src/data-src attributes
    const imgs = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));
    for (const img of imgs) {
        const src = img.getAttribute('src');
        const dataSrc = img.getAttribute('data-src');

        if (src && urlMap.has(src)) {
            img.setAttribute('src', urlMap.get(src)!);
        }
        if (dataSrc && urlMap.has(dataSrc)) {
            img.setAttribute('data-src', urlMap.get(dataSrc)!);
        }
    }
}
