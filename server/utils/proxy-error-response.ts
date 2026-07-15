/**
 * 代理层统一错误体：保留原有 base_resp，并附加 proxy_error 供客户端演进。
 */
export interface ProxyErrorPayload {
  base_resp: { ret: number; err_msg: string };
  proxy_error: {
    code: string;
    retryable: boolean;
  };
}

export function mpProxyErrorBody(message: string, options?: { code?: string; retryable?: boolean }): ProxyErrorPayload {
  return {
    base_resp: { ret: -1, err_msg: message },
    proxy_error: {
      code: options?.code ?? 'MP_PROXY_FAILED',
      retryable: options?.retryable ?? true,
    },
  };
}

export function logProxyFailure(scope: string, err: unknown, extra?: Record<string, unknown>): void {
  const payload = {
    type: 'proxy_failure',
    scope,
    message: err instanceof Error ? err.message : String(err),
    ...extra,
    ts: new Date().toISOString(),
  };
  console.error(JSON.stringify(payload));
}
