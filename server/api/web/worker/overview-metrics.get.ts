/**
 * 查询公共代理状态
 */
import { STATUS_API_SERVICE } from '~/config';
import { fetchExternal } from '~/server/utils/fetch_external';

export default defineEventHandler(async event => {
  return await fetchExternal(`${STATUS_API_SERVICE}/api/cf-worker/worker-overview-metrics`, {
    label: '获取公共代理状态',
    default: [],
  });
});
