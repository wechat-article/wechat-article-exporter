import { describe, expect, it } from 'vitest';
import {
  createOpenApiDisabledBody,
  isOpenApiEnabled,
  isPublicOpenApiPath,
  OPEN_API_ENABLED_ENV,
} from '~/server/utils/open-api-gate';

describe('open-api-gate', () => {
  it('matches only public API paths', () => {
    expect(isPublicOpenApiPath('/api/public')).toBe(true);
    expect(isPublicOpenApiPath('/api/public/v1/account')).toBe(true);
    expect(isPublicOpenApiPath('/api/public/beta/aboutbiz')).toBe(true);
    expect(isPublicOpenApiPath('/api/web/mp/searchbiz')).toBe(false);
    expect(isPublicOpenApiPath('/dashboard/article')).toBe(false);
  });

  it('requires explicit true opt-in', () => {
    expect(isOpenApiEnabled({})).toBe(false);
    expect(isOpenApiEnabled({ [OPEN_API_ENABLED_ENV]: 'false' })).toBe(false);
    expect(isOpenApiEnabled({ [OPEN_API_ENABLED_ENV]: '1' })).toBe(false);
    expect(isOpenApiEnabled({ [OPEN_API_ENABLED_ENV]: 'true' })).toBe(true);
  });

  it('returns a stable disabled payload', () => {
    expect(createOpenApiDisabledBody()).toEqual({
      code: 'OPEN_API_DISABLED',
      base_resp: {
        ret: -1,
        err_msg: 'Open API is disabled for this deployment',
      },
    });
  });
});
