export const OPEN_API_ENABLED_ENV = 'NUXT_OPEN_API_ENABLED';

export type OpenApiEnv = Partial<Record<typeof OPEN_API_ENABLED_ENV, string | undefined>>;

export function isOpenApiEnabled(env: OpenApiEnv = process.env): boolean {
  return env.NUXT_OPEN_API_ENABLED === 'true';
}

export function isPublicOpenApiPath(pathname: string): boolean {
  return pathname === '/api/public' || pathname.startsWith('/api/public/');
}

export function createOpenApiDisabledBody() {
  return {
    code: 'OPEN_API_DISABLED',
    base_resp: {
      ret: -1,
      err_msg: 'Open API is disabled for this deployment',
    },
  };
}
