/**
 * HTTP 请求失败时的可插拔观察者，避免 shared 层直接依赖外部遥测包。
 */

export interface HttpErrorContext {
  request: string;
  method?: string;
  status?: number;
  error: unknown;
}

const errorObservers: Array<(ctx: HttpErrorContext) => void> = [];

export function registerHttpErrorObserver(fn: (ctx: HttpErrorContext) => void): () => void {
  errorObservers.push(fn);
  return () => {
    const i = errorObservers.indexOf(fn);
    if (i >= 0) {
      errorObservers.splice(i, 1);
    }
  };
}

export function notifyHttpError(ctx: HttpErrorContext): void {
  for (const fn of errorObservers) {
    try {
      fn(ctx);
    } catch (e) {
      console.warn('[request-observers]', e);
    }
  }
}
