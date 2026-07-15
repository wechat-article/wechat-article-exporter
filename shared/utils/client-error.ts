/**
 * 将未知异常归一为可展示文案，供 toast / 日志使用。
 */
export function getErrorMessage(error: unknown): string {
  if (error === null || error === undefined) {
    return '未知错误';
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error) {
    return error.message || error.name || '未知错误';
  }
  if (typeof error === 'object' && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  try {
    return JSON.stringify(error);
  } catch {
    return '未知错误';
  }
}

export interface NormalizedClientError {
  message: string;
  raw: unknown;
}

export function normalizeClientError(error: unknown): NormalizedClientError {
  return {
    message: getErrorMessage(error),
    raw: error,
  };
}
