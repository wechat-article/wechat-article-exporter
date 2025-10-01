/**
 * 查询公共代理状态
 *
 * 数据由托管在 Deno Deploy 上面的 [my-cron-service 项目](https://dash.deno.com/projects/my-cron-service) 提供
 */

export default defineEventHandler(async event => {
  return await fetch('https://my-cron-service.deno.dev/api/worker-proxy').then(res => res.json());
});
