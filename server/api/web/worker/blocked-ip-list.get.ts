/**
 * 查询 ip 黑名单
 */
import { EXTERNAL_API_SERVICE } from '~/config';
import { fetchExternal } from '~/server/utils/fetch_external';

export default defineEventHandler(async event => {
  return await fetchExternal(`${EXTERNAL_API_SERVICE}/api/cf-worker/blocked-ip-list`, {
    label: '获取 IP 黑名单',
    default: [],
  });
});
