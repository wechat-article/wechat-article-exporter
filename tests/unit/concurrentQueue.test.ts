import { describe, expect, it, vi } from 'vitest';
import { runConcurrentUrlTasks } from '~/utils/download/exporter/concurrentQueue';

describe('runConcurrentUrlTasks', () => {
  it('runs all urls with bounded concurrency', async () => {
    const order: string[] = [];
    await runConcurrentUrlTasks(
      ['a', 'b', 'c'],
      async u => {
        order.push(`${u}-start`);
        await new Promise(r => setTimeout(r, 5));
        order.push(`${u}-end`);
      },
      { concurrency: 2 }
    );
    expect(order.filter(x => x.endsWith('-end')).length).toBe(3);
  });

  it('invokes onTaskError and still counts progress', async () => {
    const onProgress = vi.fn();
    await runConcurrentUrlTasks(
      ['x'],
      async () => {
        throw new Error('fail');
      },
      { onProgress, onTaskError: () => {} }
    );
    expect(onProgress).toHaveBeenCalledWith(1);
  });
});
