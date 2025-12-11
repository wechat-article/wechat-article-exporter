import dayjs from 'dayjs';
import TurndownService from 'turndown';
import { filterInvalidFilenameChars } from '#shared/utils/helpers';
import { getArticleList } from '~/apis';
import toastFactory from '~/composables/toast';
import usePreferences from '~/composables/usePreferences';
import { getArticleCache, getArticleByLink } from '~/store/v2/article';
import { getHtmlCache } from '~/store/v2/html';
import { getAllInfo, getInfoCache, type Info } from '~/store/v2/info';
import type { Preferences, AutoTaskConfig } from '~/types/preferences';
import type { AppMsgEx } from '~/types/types';
import { Downloader } from '~/utils/download/Downloader';

// 日志条目
export interface LogEntry {
    time: Date;
    level: 'info' | 'warn' | 'error' | 'success';
    message: string;
}

// 自动任务阶段
export type AutoTaskPhase = 'idle' | 'sync' | 'download' | 'export';

// 进度信息
export interface PhaseProgress {
    current: number;
    total: number;
    detail?: string;
}

/**
 * 自动任务 composable
 * 统一管理三个阶段：同步文章列表 -> 下载HTML内容 -> 导出Markdown
 */
export function useAutoTask() {
    const toast = toastFactory();
    const preferences = usePreferences();

    // 状态
    const isRunning = ref(false);
    const isPaused = ref(false);
    const currentPhase = ref<AutoTaskPhase>('idle');
    const currentAccount = ref<Info | null>(null);

    // 进度
    const syncProgress = reactive<PhaseProgress>({ current: 0, total: 0 });
    const downloadProgress = reactive<PhaseProgress>({ current: 0, total: 0 });
    const exportProgress = reactive<PhaseProgress>({ current: 0, total: 0 });

    // 日志
    const logs = ref<LogEntry[]>([]);
    const maxLogs = 100;

    // 导出目录句柄
    const exportDirectory = shallowRef<FileSystemDirectoryHandle | null>(null);
    const exportDirectoryPath = ref<string>('');

    // 内部控制
    let stopRequested = false;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let consecutiveErrors = 0;

    // 待处理队列
    const pendingDownloads = ref<string[]>([]); // 待下载HTML的文章URL
    const pendingExports = ref<string[]>([]); // 待导出的文章URL

    // 配置快捷访问
    const config = computed<AutoTaskConfig>(() =>
        (preferences.value as unknown as Preferences).autoTask
    );

    // ------ 日志功能 ------
    function log(level: LogEntry['level'], message: string) {
        const entry: LogEntry = {
            time: new Date(),
            level,
            message,
        };
        logs.value.unshift(entry);
        if (logs.value.length > maxLogs) {
            logs.value.pop();
        }
        console.log(`[AutoTask][${level.toUpperCase()}] ${message}`);
    }

    function clearLogs() {
        logs.value = [];
    }

    // ------ 目录选择 ------
    async function selectExportDirectory(): Promise<boolean> {
        try {
            // @ts-ignore - File System Access API
            const handle = await window.showDirectoryPicker({
                mode: 'readwrite',
                startIn: 'downloads',
            });
            exportDirectory.value = handle;
            exportDirectoryPath.value = handle.name;
            log('success', `已选择导出目录: ${handle.name}`);
            return true;
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                log('error', `选择目录失败: ${e.message}`);
            }
            return false;
        }
    }

    // ------ 启动/停止 ------
    async function start(): Promise<void> {
        if (isRunning.value) {
            log('warn', '自动任务已在运行中');
            return;
        }

        if (!exportDirectory.value) {
            const selected = await selectExportDirectory();
            if (!selected) {
                toast.warning('提示', '请先选择导出目录');
                return;
            }
        }

        isRunning.value = true;
        isPaused.value = false;
        stopRequested = false;
        consecutiveErrors = 0;

        log('info', '自动任务已启动');
        toast.success('自动任务', '已启动自动同步下载导出任务');

        // 开始主循环
        runMainLoop();
    }

    function stop(): void {
        if (!isRunning.value) return;

        stopRequested = true;
        if (syncTimer) {
            clearTimeout(syncTimer);
            syncTimer = null;
        }

        isRunning.value = false;
        isPaused.value = false;
        currentPhase.value = 'idle';
        currentAccount.value = null;

        log('info', '自动任务已停止');
        toast.info('自动任务', '已停止');
    }

    function pause(): void {
        if (!isRunning.value || isPaused.value) return;
        isPaused.value = true;
        log('info', '自动任务已暂停');
    }

    function resume(): void {
        if (!isRunning.value || !isPaused.value) return;
        isPaused.value = false;
        log('info', '自动任务已恢复');
        runMainLoop();
    }

    // ------ 主循环 ------
    async function runMainLoop(): Promise<void> {
        while (isRunning.value && !stopRequested) {
            if (isPaused.value) {
                await sleep(1000);
                continue;
            }

            try {
                // 阶段1：同步文章列表
                await runSyncPhase();
                if (stopRequested) break;

                // 阶段2：下载HTML内容
                await runDownloadPhase();
                if (stopRequested) break;

                // 阶段3：导出Markdown
                await runExportPhase();
                if (stopRequested) break;

                // 一轮完成，等待后开始下一轮
                log('info', `一轮任务完成，${config.value.syncIntervalSeconds}秒后开始下一轮`);
                await sleep(config.value.syncIntervalSeconds * 1000);

            } catch (e: any) {
                consecutiveErrors++;
                log('error', `任务出错: ${e.message}`);

                if (consecutiveErrors >= config.value.maxConsecutiveErrors) {
                    log('error', `连续错误次数达到上限(${config.value.maxConsecutiveErrors})，任务暂停`);
                    isPaused.value = true;
                    toast.error('自动任务', '连续错误次数过多，已暂停');
                } else {
                    log('warn', `${config.value.retryIntervalSeconds}秒后重试...`);
                    await sleep(config.value.retryIntervalSeconds * 1000);
                }
            }
        }

        currentPhase.value = 'idle';
    }

    // ------ 阶段1：同步文章列表 ------
    async function runSyncPhase(): Promise<void> {
        currentPhase.value = 'sync';
        log('info', '开始同步阶段');

        const accounts = await getAllInfo();
        syncProgress.total = accounts.length;
        syncProgress.current = 0;

        // 按优先级排序：未完成的优先
        accounts.sort((a, b) => {
            if (a.completed === b.completed) return 0;
            return a.completed ? 1 : -1;
        });

        for (const account of accounts) {
            if (stopRequested || isPaused.value) break;

            currentAccount.value = account;
            syncProgress.detail = account.nickname;

            try {
                await syncAccountArticles(account);
                consecutiveErrors = 0; // 成功则重置错误计数
            } catch (e: any) {
                if (e.message === 'session expired') {
                    log('error', 'Session已过期，请重新登录');
                    isPaused.value = true;
                    toast.error('自动任务', 'Session已过期，请重新登录后恢复任务');
                    throw e;
                }
                log('warn', `同步 ${account.nickname} 失败: ${e.message}`);
            }

            syncProgress.current++;
            await sleep(config.value.syncIntervalSeconds * 1000);
        }

        log('success', `同步阶段完成，共处理 ${accounts.length} 个公众号`);
    }

    async function syncAccountArticles(account: Info): Promise<void> {
        // 增量同步逻辑
        let begin = account.completed ? 0 : (account.count || 0);
        let hasMore = true;

        while (hasMore && !stopRequested && !isPaused.value) {
            const [articles, completed] = await getArticleList(account, begin);

            if (completed || articles.length === 0) {
                hasMore = false;
                break;
            }

            // 对于已完成账号，检查是否遇到了已缓存的文章
            if (account.completed) {
                const lastArticle = articles.at(-1);
                if (lastArticle) {
                    const cached = await getArticleCache(account.fakeid, lastArticle.create_time);
                    if (cached && cached.length > 0) {
                        log('info', `${account.nickname}: 检测到缓存边界，停止增量同步`);
                        hasMore = false;
                        break;
                    }
                }
            }

            const count = articles.filter(a => a.itemidx === 1).length;
            begin += count;

            log('info', `${account.nickname}: 已同步 ${begin} 条消息`);

            // 收集需要下载HTML的文章
            for (const article of articles) {
                const htmlCached = await getHtmlCache(article.link);
                if (!htmlCached) {
                    pendingDownloads.value.push(article.link);
                }
            }

            await sleep(config.value.syncIntervalSeconds * 1000);
        }
    }

    // ------ 阶段2：下载HTML ------
    async function runDownloadPhase(): Promise<void> {
        if (pendingDownloads.value.length === 0) {
            log('info', '无需下载HTML，跳过下载阶段');
            return;
        }

        currentPhase.value = 'download';
        log('info', `开始下载阶段，共 ${pendingDownloads.value.length} 篇文章待下载`);

        downloadProgress.total = pendingDownloads.value.length;
        downloadProgress.current = 0;

        const urls = [...pendingDownloads.value];
        pendingDownloads.value = [];

        // 使用 Downloader 下载HTML
        const downloader = new Downloader(urls);

        downloader.on('download:progress', (url: string, success: boolean) => {
            downloadProgress.current++;
            downloadProgress.detail = url.slice(0, 50) + '...';
            if (success) {
                pendingExports.value.push(url);
            }
        });

        try {
            await downloader.startDownload('html');
            log('success', `下载阶段完成，成功 ${downloadProgress.current} 篇`);
        } catch (e: any) {
            log('error', `下载阶段出错: ${e.message}`);
        }
    }

    // ------ 阶段3：导出Markdown ------
    async function runExportPhase(): Promise<void> {
        // 获取所有已下载但未导出的文章
        const accounts = await getAllInfo();
        let totalExported = 0;

        currentPhase.value = 'export';
        log('info', '开始导出阶段');

        for (const account of accounts) {
            if (stopRequested || isPaused.value) break;

            currentAccount.value = account;

            const exported = await exportAccountArticles(account);
            totalExported += exported;
        }

        if (totalExported > 0) {
            log('success', `导出阶段完成，共导出 ${totalExported} 篇文章`);
        } else {
            log('info', '没有新文章需要导出');
        }
    }

    async function exportAccountArticles(account: Info): Promise<number> {
        if (!exportDirectory.value) return 0;

        // 获取该公众号的所有文章
        const articles = await getArticleCache(account.fakeid, 0);
        if (!articles || articles.length === 0) return 0;

        // 创建公众号子目录
        const accountDirName = filterInvalidFilenameChars(account.nickname || account.fakeid);
        let accountDir: FileSystemDirectoryHandle;

        try {
            accountDir = await exportDirectory.value.getDirectoryHandle(accountDirName, { create: true });
        } catch (e: any) {
            log('error', `创建目录 ${accountDirName} 失败: ${e.message}`);
            return 0;
        }

        const turndownService = new TurndownService();
        const parser = new DOMParser();
        let exportedCount = 0;

        exportProgress.total = articles.length;
        exportProgress.current = 0;

        for (const article of articles) {
            if (stopRequested || isPaused.value) break;

            exportProgress.current++;
            exportProgress.detail = article.title;

            // 检查HTML是否已下载
            const htmlCache = await getHtmlCache(article.link);
            if (!htmlCache) {
                continue; // HTML未下载，跳过
            }

            // 生成文件名
            const filename = formatExportFilename(article, config.value.exportFilenameTemplate);

            // 检查文件是否已存在（避免重复导出）
            try {
                await accountDir.getFileHandle(filename + '.md');
                // 文件已存在，跳过
                continue;
            } catch {
                // 文件不存在，继续导出
            }

            try {
                // 获取纯净HTML内容
                const html = await htmlCache.file.text();
                const doc = parser.parseFromString(html, 'text/html');
                const content = doc.querySelector('#js_article');

                if (!content) {
                    log('warn', `文章 ${article.title} 内容解析失败`);
                    continue;
                }

                // 处理图片
                const imgs = content.querySelectorAll<HTMLImageElement>('img');
                imgs.forEach(img => {
                    const dataSrc = img.getAttribute('data-src');
                    if (dataSrc) {
                        img.setAttribute('src', dataSrc);
                    }
                });

                // 删除无用元素
                content.querySelector('#js_top_ad_area')?.remove();
                content.querySelector('#js_tags_preview_toast')?.remove();
                content.querySelector('#content_bottom_area')?.remove();
                content.querySelectorAll('script').forEach(el => el.remove());

                // 转换为Markdown
                const markdown = turndownService.turndown(content.outerHTML);

                // 添加元数据头
                const frontMatter = `---
title: "${article.title.replace(/"/g, '\\"')}"
author: "${account.nickname}"
date: ${dayjs.unix(article.create_time).format('YYYY-MM-DD HH:mm:ss')}
url: ${article.link}
---

`;
                const finalContent = frontMatter + markdown;

                // 写入文件
                const fileHandle = await accountDir.getFileHandle(filename + '.md', { create: true });
                // @ts-ignore
                const writable = await fileHandle.createWritable();
                await writable.write(new Blob([finalContent], { type: 'text/markdown' }));
                await writable.close();

                exportedCount++;

                await sleep(config.value.exportIntervalSeconds * 1000);

            } catch (e: any) {
                log('warn', `导出 ${article.title} 失败: ${e.message}`);
            }
        }

        if (exportedCount > 0) {
            log('info', `${account.nickname}: 导出 ${exportedCount} 篇文章`);
        }

        return exportedCount;
    }

    function formatExportFilename(article: AppMsgEx, template: string): string {
        const updateTime = dayjs.unix(article.create_time);
        let filename = template;

        filename = filename.replace(/\${YYYY}/g, updateTime.format('YYYY'));
        filename = filename.replace(/\${MM}/g, updateTime.format('MM'));
        filename = filename.replace(/\${DD}/g, updateTime.format('DD'));
        filename = filename.replace(/\${HH}/g, updateTime.format('HH'));
        filename = filename.replace(/\${mm}/g, updateTime.format('mm'));
        filename = filename.replace(/\${title}/g, filterInvalidFilenameChars(article.title));

        return filename;
    }

    // ------ 工具函数 ------
    function sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    return {
        // 状态
        isRunning: readonly(isRunning),
        isPaused: readonly(isPaused),
        currentPhase: readonly(currentPhase),
        currentAccount: readonly(currentAccount),

        // 进度
        syncProgress: readonly(syncProgress),
        downloadProgress: readonly(downloadProgress),
        exportProgress: readonly(exportProgress),

        // 日志
        logs: readonly(logs),
        clearLogs,

        // 目录
        exportDirectory: readonly(exportDirectory),
        exportDirectoryPath: readonly(exportDirectoryPath),
        selectExportDirectory,

        // 操作
        start,
        stop,
        pause,
        resume,
    };
}
