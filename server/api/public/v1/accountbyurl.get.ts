import { request } from '#shared/utils/request';
import { enforceRateLimit } from '~/server/utils/rate-limit';

interface UrlQuery {
  url: string;
}

export default defineEventHandler(async event => {
  // 分级限流（查询类）：游客 5 次/分钟（按 IP），会员 100 次/分钟（按 X-Api-Token）
  await enforceRateLimit(event, 'query');

  const { url } = getQuery<UrlQuery>(event);

  return await request('/api/web/mp/searchbyurl?url=' + encodeURIComponent(url), {
    headers: {
      'X-Auth-Key': getHeader(event, 'X-Auth-Key')!,
      Cookie: getHeader(event, 'Cookie')!,
    },
  });
});
