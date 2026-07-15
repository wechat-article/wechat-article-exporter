/**
 * 与 Exporter.processFileExportQueue 相同的并发模型：Promise.race + 有界并发。
 */
export async function runConcurrentUrlTasks(
  urls: readonly string[],
  task: (url: string) => Promise<void>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number) => void;
    onTaskError?: (url: string, err: unknown) => void;
  } = {}
): Promise<void> {
  const { concurrency = 5, onProgress, onTaskError } = options;
  const activePromises: Set<Promise<void>> = new Set();
  const queue = [...urls];
  let completedCount = 0;

  while (queue.length > 0 || activePromises.size > 0) {
    while (activePromises.size < concurrency && queue.length > 0) {
      const url = queue.pop()!;
      const promise = task(url)
        .then(() => {
          completedCount++;
          onProgress?.(completedCount);
        })
        .catch(e => {
          onTaskError?.(url, e);
          completedCount++;
          onProgress?.(completedCount);
        });
      activePromises.add(promise);
      promise.finally(() => {
        activePromises.delete(promise);
      });
    }

    if (activePromises.size > 0) {
      await Promise.race(activePromises);
    }
  }
}
