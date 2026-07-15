import type { H3Event } from 'h3';
import { createError, getRequestIP } from 'h3';

const buckets = new Map<string, number[]>();

/**
 * 简单按 IP 滑动窗口限流（进程内，多实例需网关层或 Redis）。
 */
export function assertRateLimit(event: H3Event, key: string, maxPerWindow: number, windowMs = 60_000): void {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown';
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  let stamps = buckets.get(bucketKey) ?? [];
  stamps = stamps.filter(t => now - t < windowMs);
  if (stamps.length >= maxPerWindow) {
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: '请求过于频繁，请稍后再试',
    });
  }
  stamps.push(now);
  buckets.set(bucketKey, stamps);
}
