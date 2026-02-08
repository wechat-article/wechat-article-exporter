/**
 * 查询公共代理状态
 */
import { EXTERNAL_API_SERVICE } from '~/config';
import { fetchExternal } from '~/server/utils/fetch_external';

export default defineEventHandler(async event => {
  return await fetchExternal(`${EXTERNAL_API_SERVICE}/api/cf-worker/worker-overview-metrics`, {
    label: '获取公共代理状态',
    default: [],
  });
});
