/**
 * 查询公共代理安全统计（已停用外部服务，返回空）
 */
export default defineEventHandler(async () => {
  return { topClientIPs: [], total: 0 };
});
