import dayjs from 'dayjs';
import { ITEM_SHOW_TYPE } from '~/config';

export function sleep(ms: number = 1000): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function timeout(ms: number = 1000): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error('operation timeout')), ms);
  });
}

export function throwException(message: string) {
  throw new Error(message);
}

export function maxLen(text: string, max = 35): string {
  if (text.length > max) {
    return text.slice(0, max) + '...';
  }
  return text;
}

// 过滤文件名中的非法字符
export function filterInvalidFilenameChars(input: string): string {
  // 只保留中文字符、英文字符、数字
  const regex = /[^\u4e00-\u9fa5a-zA-Z0-9()（）]/g;
  return input.replace(regex, '_').slice(0, 100).trim();
}

// 格式化消耗时间
export function formatElapsedTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  let result = '';
  if (hours > 0) {
    result += `${hours}小时`;
  }
  if (minutes > 0) {
    result += `${minutes}分`;
  }
  if (secs > 0 || result === '') {
    result += `${secs}秒`;
  }
  return result;
}

// 将时长字符串转为秒数
export function durationToSeconds(duration: string | undefined) {
  if (!duration) return 0;
  const [min, sec] = duration.split(':').map(Number);
  return min * 60 + sec;
}

// 时间戳(单位秒)转日期字符串
export function formatTimeStamp(timestamp: number) {
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

// 格式化文章显示类型
export function formatItemShowType(type: number) {
  return ITEM_SHOW_TYPE[type] || '未识别';
}

/**
 * 规范化微信文章 URL
 * 微信文章 URL 包含动态追踪参数，同一篇文章不同时间访问会有不同 URL
 * 只提取稳定参数：__biz, mid, idx, sn 来生成规范化 URL
 * 
 * @example
 * // 输入: https://mp.weixin.qq.com/s?__biz=xxx&mid=123&idx=1&sn=abc&chksm=yyy&scene=21
 * // 输出: https://mp.weixin.qq.com/s?__biz=xxx&mid=123&idx=1&sn=abc
 */
export function normalizeWechatUrl(url: string): string {
  // 检查是否是微信公众号文章 URL
  if (!url.includes('mp.weixin.qq.com')) {
    return url; // 非微信 URL，保持原样
  }

  try {
    const parsed = new URL(url);
    const biz = parsed.searchParams.get('__biz') || '';
    const mid = parsed.searchParams.get('mid') || '';
    const idx = parsed.searchParams.get('idx') || '1';
    const sn = parsed.searchParams.get('sn') || '';

    // 如果核心参数都存在，生成规范化 URL
    if (biz && mid && sn) {
      return `https://mp.weixin.qq.com/s?__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}`;
    }

    // 如果缺少核心参数，返回原 URL
    return url;
  } catch {
    // URL 解析失败，返回原 URL
    return url;
  }
}
