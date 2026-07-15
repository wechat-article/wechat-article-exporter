import { describe, expect, it } from 'vitest';
import { getErrorMessage, normalizeClientError } from '#shared/utils/client-error';

describe('client-error', () => {
  it('getErrorMessage handles Error', () => {
    expect(getErrorMessage(new Error('x'))).toBe('x');
  });

  it('getErrorMessage handles string', () => {
    expect(getErrorMessage('plain')).toBe('plain');
  });

  it('normalizeClientError wraps unknown', () => {
    const n = normalizeClientError({ message: 'm' });
    expect(n.message).toBe('m');
  });
});
