/**
 * 查询公共代理状态
 */
import { EXTERNAL_API_SERVICE } from '~/config';
import { fetchExternal } from '~/server/utils/fetch_external';

interface NameQuery {
  name: string;
}

export default defineEventHandler(async event => {
  const { name } = getQuery<NameQuery>(event);

  return await fetchExternal(`${EXTERNAL_API_SERVICE}/api/cf-worker/worker-security-top-n?name=${name}`, {
    label: '获取公共代理状态',
    default: [],
  });
});
