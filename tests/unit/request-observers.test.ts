import { describe, expect, it, vi } from 'vitest';
import { notifyHttpError, registerHttpErrorObserver } from '#shared/utils/request-observers';

describe('request-observers', () => {
  it('notifies registered observers', () => {
    const fn = vi.fn();
    const unregister = registerHttpErrorObserver(fn);
    notifyHttpError({ request: '/a', status: 500, error: new Error('e') });
    expect(fn).toHaveBeenCalledTimes(1);
    unregister();
    notifyHttpError({ request: '/b', error: new Error('e') });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
