import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { normalizeHtml } from '#shared/utils/html';
import { cookieStore } from './CookieStore';

interface TaskStatus {
  status: 'idle' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  error?: string;
}

export const syncTasks = new Map<string, TaskStatus>();
export const downloadTasks = new Map<string, TaskStatus>();

const BASE_WORKSPACE = '/workspace';

function getMetaDir(nickname: string): string {
  const dir = path.join(BASE_WORKSPACE, '.meta', nickname);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export async function startSyncTask(fakeid: string, nickname: string, authKey: string) {
  const current = syncTasks.get(fakeid);
  if (current && current.status === 'running') {
    return;
  }

  syncTasks.set(fakeid, {
    status: 'running',
    progress: 0,
    total: 0,
  });

  (async () => {
    try {
      const accountCookie = await cookieStore.getAccountCookie(authKey);
      if (!accountCookie) {
        throw new Error('未找到对应的登录凭证，请重新扫码登录');
      }

      const token = accountCookie.token;
      const cookieStr = accountCookie.toString();

      let begin = 0;
      let size = 10;
      let allArticles: any[] = [];
      let total_count = 0;

      while (true) {
        const queryParams = new URLSearchParams({
          sub: 'list',
          begin: String(begin),
          count: String(size),
          fakeid: fakeid,
          type: '101_1',
          free_publish_type: '1',
          sub_action: 'list_ex',
          token: token,
          lang: 'zh_CN',
          f: 'json',
          ajax: '1',
        });

        const url = `https://mp.weixin.qq.com/cgi-bin/appmsgpublish?${queryParams.toString()}`;
        const resp = await fetch(url, {
          headers: {
            Referer: 'https://mp.weixin.qq.com/',
            Origin: 'https://mp.weixin.qq.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            Cookie: cookieStr,
          }
        });

        if (!resp.ok) {
          throw new Error(`HTTP error! status: ${resp.status}`);
        }

        const body = await resp.json();
        if (body.base_resp.ret !== 0) {
          throw new Error(`微信接口错误: ${body.base_resp.err_msg} (代码: ${body.base_resp.ret})`);
        }

        const publish_page = JSON.parse(body.publish_page);
        total_count = publish_page.total_count;

        const publish_list = publish_page.publish_list.filter((item: any) => !!item.publish_info);
        if (publish_list.length === 0) {
          break;
        }

        for (const item of publish_list) {
          const publish_info = JSON.parse(item.publish_info);
          for (const article of publish_info.appmsgex) {
            allArticles.push(article);
          }
        }

        syncTasks.set(fakeid, {
          status: 'running',
          progress: allArticles.length,
          total: total_count,
        });

        begin += publish_list.length;
        if (allArticles.length >= total_count) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      const metaDir = getMetaDir(nickname);
      fs.writeFileSync(path.join(metaDir, 'articles.json'), JSON.stringify(allArticles, null, 2), 'utf8');
      fs.writeFileSync(path.join(metaDir, 'info.json'), JSON.stringify({
        nickname,
        fakeid,
        total_count: allArticles.length,
        last_sync: Date.now(),
      }, null, 2), 'utf8');

      syncTasks.set(fakeid, {
        status: 'completed',
        progress: allArticles.length,
        total: allArticles.length,
      });

    } catch (e: any) {
      console.error('Server sync failed:', e);
      syncTasks.set(fakeid, {
        status: 'failed',
        progress: 0,
        total: 0,
        error: e.message,
      });
    }
  })();
}

export async function startDownloadTask(
  fakeid: string,
  nickname: string,
  proxyUrl?: string,
  customArticles?: any[]
) {
  const current = downloadTasks.get(fakeid);
  if (current && current.status === 'running') {
    return;
  }

  downloadTasks.set(fakeid, {
    status: 'running',
    progress: 0,
    total: 0,
  });

  (async () => {
    try {
      let articles = customArticles;
      const metaDir = getMetaDir(nickname);
      const downloadedPath = path.join(metaDir, 'downloaded.json');
      
      // 读取已下载的 url 列表以追加写入
      let downloadedUrls: string[] = [];
      if (fs.existsSync(downloadedPath)) {
        try {
          downloadedUrls = JSON.parse(fs.readFileSync(downloadedPath, 'utf8'));
        } catch (e) {}
      }
      const downloadedSet = new Set(downloadedUrls);

      if (!articles) {
        const articlesPath = path.join(metaDir, 'articles.json');
        if (!fs.existsSync(articlesPath)) {
          throw new Error('未找到该公众号的同步数据，请先同步文章列表');
        }
        articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
      }

      const total = articles.length;
      downloadTasks.set(fakeid, {
        status: 'running',
        progress: 0,
        total: total,
      });

      let downloadedCount = 0;
      const turndownService = new TurndownService({
        headingStyle: 'atx',
        hr: '---',
        bulletListMarker: '-',
        codeBlockStyle: 'fenced',
      });

      for (const article of articles) {
        try {
          const url = article.link;
          let rawHtml = '';

          const date = new Date(article.create_time * 1000);
          const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          const downloadDir = path.join(BASE_WORKSPACE, 'dataset', nickname, yearMonth);
          const assetsDir = path.join(downloadDir, 'assets');
          if (!fs.existsSync(assetsDir)) {
            fs.mkdirSync(assetsDir, { recursive: true });
          }

          // 1. Fetch HTML
          if (proxyUrl) {
            const fetchUrl = `${proxyUrl.replace(/\/$/, '')}?url=${encodeURIComponent(url)}`;
            const resp = await fetch(fetchUrl);
            rawHtml = await resp.text();
          } else {
            const resp = await fetch(url);
            rawHtml = await resp.text();
          }

          // 2. Normalize HTML (移除脚本、广告等)
          const cleanHtml = normalizeHtml(rawHtml, 'html');

          // 3. Cheerio 解析 HTML 并下载图片，更新为本地资源相对路径
          const $ = cheerio.load(cleanHtml);
          const imgs = $('img').toArray();
          for (const img of imgs) {
            const $img = $(img);
            const imgSrc = $img.attr('src');
            if (!imgSrc || !imgSrc.startsWith('http')) continue;

            try {
              const urlObj = new URL(imgSrc);
              const tpParam = urlObj.searchParams.get('wx_fmt') || 'jpg';
              const imgName = `${crypto.randomUUID()}.${tpParam}`;
              const imgPath = path.join(assetsDir, imgName);

              const imgResp = await fetch(imgSrc);
              if (imgResp.ok) {
                const buffer = await imgResp.arrayBuffer();
                fs.writeFileSync(imgPath, Buffer.from(buffer));
                $img.attr('src', `./assets/${imgName}`);
              }
            } catch (err) {
              console.error(`Failed to download image: ${imgSrc}`, err);
            }
          }

          // 4. 将 HTML 转换为 Markdown
          const updatedHtml = $.html();
          const markdown = turndownService.turndown(updatedHtml);

          // 5. 保存为 .md 文件，命名格式：<文章名>-<发布时间>.md
          const dateStr = new Date(article.create_time * 1000).toISOString().split('T')[0];
          const safeTitle = article.title.replace(/[\\/:*?"<>|]/g, '_');
          const fileName = `${safeTitle}-${dateStr}.md`;
          const filePath = path.join(downloadDir, fileName);

          fs.writeFileSync(filePath, markdown, 'utf8');

          // 记录已成功下载的 url
          downloadedSet.add(url);
          fs.writeFileSync(downloadedPath, JSON.stringify(Array.from(downloadedSet)), 'utf8');

        } catch (err) {
          console.error(`Failed to download article ${article.title}:`, err);
        }

        downloadedCount++;
        downloadTasks.set(fakeid, {
          status: 'running',
          progress: downloadedCount,
          total: total,
        });

        // 避免频繁抓取触发风控，延迟 1.5 秒
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      downloadTasks.set(fakeid, {
        status: 'completed',
        progress: total,
        total: total,
      });

    } catch (e: any) {
      console.error('Server download failed:', e);
      downloadTasks.set(fakeid, {
        status: 'failed',
        progress: 0,
        total: 0,
        error: e.message,
      });
    }
  })();
}
