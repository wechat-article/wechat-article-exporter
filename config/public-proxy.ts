/**
 * 公共代理节点
 */
export const PUBLIC_PROXY_LIST: string[] = [
  ...getDomainProxyList('worker-proxy.asia'),
  ...getDomainProxyList('net-proxy.asia'),
  ...getDomainProxyList('1235566.space'),
  ...getDomainProxyList('worker-proxy.shop'),
  ...getDomainProxyList('worker-proxys.cyou'),
  ...getDomainProxyList('worker-proxy.cyou'),
];

// 生成从00.到15.的16个二级域名
function getDomainProxyList(domain: string): string[] {
  const list: string[] = [];
  for (let i = 0; i < 16; i++) {
    list.push(`https://${('0' + i).slice(-2)}.${domain}`);
  }
  return list;
}
