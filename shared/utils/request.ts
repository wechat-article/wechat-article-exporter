/**
 * 封装 $fetch：轻量重试，并在请求异常时通知本地观察者。
 */
import { notifyHttpError } from '#shared/utils/request-observers';

function requestUrlString(request: RequestInfo): string {
  if (typeof request === 'string') {
    return request;
  }
  if (request instanceof Request) {
    return request.url;
  }
  return String(request);
}

/** 默认不重试：同一实例同时用于 POST 登录等，避免重复提交。GET 可在调用处传 `{ retry: 1, retryStatusCodes: [...] }`。 */
export const request = $fetch.create({
  retry: 0,
  method: 'GET',
  async onResponseError({ request: req, response, error, options }) {
    const method = (options.method as string | undefined) || 'GET';
    notifyHttpError({
      request: requestUrlString(req),
      method,
      status: response?.status,
      error: error ?? new Error(response ? `HTTP ${response.status}` : 'Response error'),
    });
  },
  async onRequestError({ request: req, error, options }) {
    const method = (options.method as string | undefined) || 'GET';
    notifyHttpError({
      request: requestUrlString(req),
      method,
      error,
    });
  },
});
