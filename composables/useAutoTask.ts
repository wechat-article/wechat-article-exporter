import dayjs from 'dayjs';
import TurndownService from 'turndown';
import { filterInvalidFilenameChars } from '#shared/utils/helpers';
import { getArticleList } from '~/apis';
import toastFactory from '~/composables/toast';
import usePreferences from '~/composables/usePreferences';
import {
    loadPersistedState,
    savePersistedState,
    clearPersistedState,
    hasResumableTask,
    markAsPaused,
    type PersistedAutoTaskState,
} from '~/composables/useAutoTaskPersistence';
import { getArticleCache, getArticleByLink } from '~/store/v2/article';
import { getHtmlCache, checkHtmlExistsBatch, getHtmlBatch } from '~/store/v2/html';
import { getAllInfo, getInfoCache, type Info } from '~/store/v2/info';
import type { Preferences, AutoTaskConfig } from '~/types/preferences';
import type { AppMsgEx } from '~/types/types';
import { Downloader } from '~/utils/download/Downloader';
import { extractImageUrlsFromHtml, uploadImagesToHost, replaceImageUrlsInDom } from '~/utils/download/imageUploader';

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

    // 断点续传：已处理的公众号 fakeid 列表
    const processedAccountIds = ref<string[]>([]);

    // 是否需要恢复任务
    const needsResume = ref(false);

    // 配置快捷访问
    const config = computed<AutoTaskConfig>(() =>
        (preferences.value as unknown as Preferences).autoTask
    );

    // ------ 状态持久化 ------
    function restoreFromPersistedState(): void {
        const persisted = loadPersistedState();
        if (!persisted) return;

        // 恢复状态
        isRunning.value = persisted.isRunning;
        isPaused.value = persisted.isPaused;
        currentPhase.value = persisted.currentPhase;
        syncProgress.current = persisted.syncProgress.current;
        syncProgress.total = persisted.syncProgress.total;
        downloadProgress.current = persisted.downloadProgress.current;
        downloadProgress.total = persisted.downloadProgress.total;
        exportProgress.current = persisted.exportProgress.current;
        exportProgress.total = persisted.exportProgress.total;
        processedAccountIds.value = persisted.processedAccountIds || [];

        // 恢复日志
        if (persisted.logs && persisted.logs.length > 0) {
            logs.value = persisted.logs.map(l => ({
                time: new Date(l.time),
                level: l.level,
                message: l.message,
            }));
        }

        // 如果任务正在运行，标记需要恢复
        if (persisted.isRunning) {
            needsResume.value = true;
            // 先暂停，等待用户重新选择目录后恢复
            isPaused.value = true;
            log('warn', '检测到未完成的任务，请重新选择导出目录后点击恢复');
        }
    }

    function persistCurrentState(): void {
        const state: Partial<PersistedAutoTaskState> = {
            isRunning: isRunning.value,
            isPaused: isPaused.value,
            currentPhase: currentPhase.value,
            currentAccountFakeid: currentAccount.value?.fakeid || null,
            syncProgress: { ...syncProgress },
            downloadProgress: { ...downloadProgress },
            exportProgress: { ...exportProgress },
            processedAccountIds: processedAccountIds.value,
            logs: logs.value.slice(0, 20).map(l => ({
                time: l.time.toISOString(),
                level: l.level,
                message: l.message,
            })),
        };
        savePersistedState(state);
    }

    // 初始化时恢复状态
    restoreFromPersistedState();

    // 监听状态变化并自动保存
    watch(
        [isRunning, isPaused, currentPhase, () => syncProgress.current, () => downloadProgress.current, () => exportProgress.current],
        () => {
            if (isRunning.value) {
                persistCurrentState();
            }
        },
        { deep: true }
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
        processedAccountIds.value = [];
        needsResume.value = false;

        // 清除持久化状态
        clearPersistedState();

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
                // 获取所有公众号
                const accounts = await getAllInfo();

                // 按优先级排序：未完成的优先
                accounts.sort((a, b) => {
                    if (a.completed === b.completed) return 0;
                    return a.completed ? 1 : -1;
                });

                syncProgress.total = accounts.length;
                syncProgress.current = 0;

                // 按公众号逐个处理：同步 -> 下载 -> 导出
                for (const account of accounts) {
                    if (stopRequested || isPaused.value) break;

                    // 断点续传：跳过已处理的公众号
                    if (processedAccountIds.value.includes(account.fakeid)) {
                        log('info', `跳过已处理的公众号: ${account.nickname}`);
                        syncProgress.current++;
                        continue;
                    }

                    currentAccount.value = account;
                    syncProgress.current++;
                    syncProgress.detail = account.nickname;

                    log('info', `开始处理公众号: ${account.nickname}`);

                    try {
                        // 步骤1：同步该公众号的文章列表（获取新文章）
                        currentPhase.value = 'sync';
                        await syncAccountArticles(account);
                        if (stopRequested || isPaused.value) break;

                        // 步骤2：获取所有文章，检查并下载缺失的HTML
                        currentPhase.value = 'download';
                        const allArticles = await getArticleCache(account.fakeid, 0);

                        if (allArticles && allArticles.length > 0) {
                            // 批量检查已下载的 HTML（一次请求）
                            const allUrls = allArticles.map(a => a.link);
                            log('info', `${account.nickname}: 批量检查 ${allUrls.length} 篇文章的下载状态...`);

                            const existingUrls = await checkHtmlExistsBatch(allUrls);
                            const existingUrlSet = new Set(existingUrls);

                            // 找出缺失的 URL
                            const missingHtmlUrls = allUrls.filter(url => !existingUrlSet.has(url));

                            if (missingHtmlUrls.length > 0) {
                                log('info', `${account.nickname}: 需要下载 ${missingHtmlUrls.length} 篇文章的HTML`);
                                await downloadAccountArticles(missingHtmlUrls);
                            } else {
                                log('info', `${account.nickname}: 所有文章HTML已下载`);
                            }

                            if (stopRequested || isPaused.value) break;
                        }

                        // 步骤3：导出该公众号的Markdown
                        currentPhase.value = 'export';
                        await exportAccountArticles(account);

                        log('success', `公众号 ${account.nickname} 处理完成`);
                        consecutiveErrors = 0;

                        // 记录已处理的公众号
                        processedAccountIds.value.push(account.fakeid);
                        persistCurrentState();

                        // 公众号间等待，防止被限流
                        await sleep(config.value.syncIntervalSeconds * 1000);

                    } catch (e: any) {
                        if (e.message === 'session expired') {
                            log('error', 'Session已过期，请重新登录');
                            isPaused.value = true;
                            toast.error('自动任务', 'Session已过期，请重新登录后恢复任务');
                            throw e;
                        }
                        log('warn', `处理公众号 ${account.nickname} 失败: ${e.message}`);
                    }
                }

                if (!stopRequested && !isPaused.value) {
                    // 一轮完成，清除已处理列表，准备下一轮
                    processedAccountIds.value = [];
                    log('info', `一轮任务完成，${config.value.syncIntervalSeconds}秒后开始下一轮`);
                    await sleep(config.value.syncIntervalSeconds * 1000);
                }

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

    // ------ 下载单个公众号的文章 ------
    async function downloadAccountArticles(urls: string[]): Promise<void> {
        if (urls.length === 0) {
            log('info', '无需下载HTML');
            return;
        }

        log('info', `下载 ${urls.length} 篇文章...`);

        downloadProgress.total = urls.length;
        downloadProgress.current = 0;

        // 使用 Downloader 下载HTML
        const downloader = new Downloader(urls);

        downloader.on('download:progress', (url: string, success: boolean) => {
            downloadProgress.current++;
            downloadProgress.detail = url.slice(0, 50) + '...';
        });

        try {
            await downloader.startDownload('html');
            log('success', `下载完成，成功 ${downloadProgress.current}/${urls.length} 篇`);
        } catch (e: any) {
            log('error', `下载出错: ${e.message}`);
        }
    }


    async function syncAccountArticles(account: Info): Promise<string[]> {
        const collectedUrls: string[] = [];

        // 对于已完成的账号，只检查是否有新文章（快速检查）
        if (account.completed) {
            // 获取第一页，检查最新文章是否已在缓存中
            const [articles, _] = await getArticleList(account, 0);

            if (articles.length === 0) {
                log('info', `${account.nickname}: 无新文章`);
                return collectedUrls;
            }

            const firstArticle = articles[0];
            const cached = await getArticleCache(account.fakeid, firstArticle.create_time);

            if (cached && cached.length > 0) {
                log('info', `${account.nickname}: 无新文章（已是最新）`);
                // 收集文章URL
                for (const article of articles) {
                    collectedUrls.push(article.link);
                }
                return collectedUrls;
            }

            // 有新文章，继续增量同步
            log('info', `${account.nickname}: 检测到新文章，开始增量同步`);
        }

        // 未完成账号或有新文章：从断点继续同步
        let begin = account.completed ? 0 : (account.count || 0);
        let hasMore = true;
        let syncedCount = 0;

        while (hasMore && !stopRequested && !isPaused.value) {
            // 第一次请求已在上面完成（对于completed账号），跳过
            if (account.completed && begin === 0 && syncedCount === 0) {
                // 已在上面完成第一次请求
                begin += 5; // 假设每页5条，跳过第一页
                syncedCount++;
                continue;
            }

            const [articles, completed] = await getArticleList(account, begin);
            syncedCount++;

            if (completed || articles.length === 0) {
                hasMore = false;
                break;
            }

            // 检查是否遇到已缓存的文章边界
            const lastArticle = articles.at(-1);
            if (lastArticle) {
                const cached = await getArticleCache(account.fakeid, lastArticle.create_time);
                if (cached && cached.length > 0) {
                    log('info', `${account.nickname}: 检测到缓存边界，停止同步`);
                    hasMore = false;
                }
            }

            const count = articles.filter(a => a.itemidx === 1).length;
            begin += count;

            log('info', `${account.nickname}: 已同步 ${begin} 条消息`);

            // 收集文章URL
            for (const article of articles) {
                collectedUrls.push(article.link);
            }

            // 仅在继续请求时等待（避免频率限制）
            if (hasMore) {
                await sleep(config.value.syncIntervalSeconds * 1000);
            }
        }

        return collectedUrls;
    }

    async function exportAccountArticles(account: Info): Promise<number> {
        if (!exportDirectory.value) return 0;

        // 获取该公众号的所有文章
        const articles = await getArticleCache(account.fakeid, 0);
        if (!articles || articles.length === 0) {
            log('info', `${account.nickname}: 无文章需要导出`);
            return 0;
        }

        log('info', `${account.nickname}: 共 ${articles.length} 篇文章`);

        // 批量获取所有 HTML 内容（一次请求）
        const articleUrls = articles.map(a => a.link);
        log('info', `${account.nickname}: 批量获取 ${articleUrls.length} 篇文章的HTML内容...`);
        const htmlMap = await getHtmlBatch(articleUrls);
        log('info', `${account.nickname}: 获取到 ${htmlMap.size} 篇文章的HTML`);

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
        let skippedCount = 0;

        exportProgress.total = articles.length;
        exportProgress.current = 0;

        // 串行处理每篇文章
        for (const article of articles) {
            if (stopRequested || isPaused.value) break;

            exportProgress.current++;
            exportProgress.detail = `(${exportProgress.current}/${articles.length}) ${article.title}`;

            // 从预取的 Map 中获取 HTML
            const htmlCache = htmlMap.get(article.link);
            if (!htmlCache) {
                skippedCount++;
                continue; // HTML未下载，跳过
            }

            // 生成文件名
            const filename = formatExportFilename(article, config.value.exportFilenameTemplate);

            // 检查文件是否已存在（避免重复导出）
            try {
                await accountDir.getFileHandle(filename + '.md');
                // 文件已存在，跳过
                skippedCount++;
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
                    log('warn', `${article.title}: 内容解析失败`);
                    continue;
                }

                // 处理图片：收集URL并上传到图床（如果启用）
                let imageUrlMap = new Map<string, string>();
                const imageHostConfig = (preferences.value as unknown as Preferences).imageHost;

                if (imageHostConfig.enabled) {
                    const imageUrls = extractImageUrlsFromHtml(content.outerHTML);
                    if (imageUrls.length > 0) {
                        try {
                            imageUrlMap = await uploadImagesToHost(imageUrls, {
                                apiUrl: imageHostConfig.apiUrl,
                                batchSize: imageHostConfig.batchSize,
                            });
                        } catch (uploadError: any) {
                            log('warn', `${article.title}: 图片上传失败: ${uploadError.message}`);
                        }
                    }
                }

                // 替换图片URL（包含data-src处理）
                const imgs = content.querySelectorAll<HTMLImageElement>('img');
                imgs.forEach(img => {
                    const dataSrc = img.getAttribute('data-src');
                    const src = img.getAttribute('src');
                    let originalUrl = dataSrc || src || '';

                    const hostedUrl = imageUrlMap.get(originalUrl);
                    if (hostedUrl) {
                        img.setAttribute('src', hostedUrl);
                    } else if (originalUrl) {
                        img.setAttribute('src', originalUrl);
                    }
                    img.removeAttribute('data-src');
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

            } catch (e: any) {
                log('warn', `${article.title}: 导出失败 - ${e.message}`);
            }
        }

        log('success', `${account.nickname}: 导出 ${exportedCount} 篇，跳过 ${skippedCount} 篇`);
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
        needsResume: readonly(needsResume),

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

        // 持久化
        hasResumableTask,
        markAsPaused,
    };
}
