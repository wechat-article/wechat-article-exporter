import * as fs from 'fs';
import * as path from 'path';
import * as cheerio from 'cheerio';
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
  // If already running, do nothing
  const current = syncTasks.get(fakeid);
  if (current && current.status === 'running') {
    return;
  }

  syncTasks.set(fakeid, {
    status: 'running',
    progress: 0,
    total: 0,
  });

  // Run in background
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

        // 避免微信风控，延迟 3 秒
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      // 写入服务器的 .meta/<公众号名> 文件夹中
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

export async function startDownloadTask(fakeid: string, nickname: string, proxyUrl?: string) {
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
      const metaDir = path.join(BASE_WORKSPACE, '.meta', nickname);
      const articlesPath = path.join(metaDir, 'articles.json');
      if (!fs.existsSync(articlesPath)) {
        throw new Error('未找到该公众号的同步数据，请先同步文章列表');
      }

      const articles = JSON.parse(fs.readFileSync(articlesPath, 'utf8'));
      const total = articles.length;
      downloadTasks.set(fakeid, {
        status: 'running',
        progress: 0,
        total: total,
      });

      const downloadDir = path.join(BASE_WORKSPACE, `.${nickname}`);
      const assetsDir = path.join(downloadDir, 'assets');
      if (!fs.existsSync(assetsDir)) {
        fs.mkdirSync(assetsDir, { recursive: true });
      }

      let downloadedCount = 0;

      for (const article of articles) {
        try {
          const url = article.link;
          let htmlText = '';

          // 1. Fetch HTML
          if (proxyUrl) {
            const fetchUrl = `${proxyUrl.replace(/\/$/, '')}?url=${encodeURIComponent(url)}`;
            const resp = await fetch(fetchUrl);
            htmlText = await resp.text();
          } else {
            const resp = await fetch(url);
            htmlText = await resp.text();
          }

          // 2. Parse HTML with cheerio
          const $ = cheerio.load(htmlText);

          // 3. Process images
          const imgs = $('img').toArray();
          for (const img of imgs) {
            const $img = $(img);
            const imgSrc = $img.attr('data-src') || $img.attr('src');
            if (!imgSrc || !imgSrc.startsWith('http')) continue;

            try {
              // 统一使用 UUID 存为 JPG/PNG
              const urlObj = new URL(imgSrc);
              const tpParam = urlObj.searchParams.get('wx_fmt') || 'jpg';
              const imgName = `${crypto.randomUUID()}.${tpParam}`;
              const imgPath = path.join(assetsDir, imgName);

              const imgResp = await fetch(imgSrc);
              if (imgResp.ok) {
                const buffer = await imgResp.arrayBuffer();
                fs.writeFileSync(imgPath, Buffer.from(buffer));

                $img.attr('src', `./assets/${imgName}`);
                $img.removeAttr('data-src');
              }
            } catch (err) {
              console.error(`Failed to download image: ${imgSrc}`, err);
            }
          }

          // 4. Save HTML
          const dateStr = new Date(article.create_time * 1000).toISOString().split('T')[0];
          const safeTitle = article.title.replace(/[\\/:*?"<>|]/g, '_');
          const fileName = `[${dateStr}] ${safeTitle}.html`;
          const filePath = path.join(downloadDir, fileName);

          fs.writeFileSync(filePath, $.html(), 'utf8');

        } catch (err) {
          console.error(`Failed to download article ${article.title}:`, err);
        }

        downloadedCount++;
        downloadTasks.set(fakeid, {
          status: 'running',
          progress: downloadedCount,
          total: total,
        });

        // 避免频繁抓取被微信限制，延迟 1.5 秒
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
