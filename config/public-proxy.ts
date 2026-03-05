/**
 * 公共代理节点
 */
export const PUBLIC_PROXY_LIST: string[] = [
  ...getDomainProxyList('worker-proxy.asia'),
  ...getDomainProxyList('net-proxy.asia'),
  ...getDomainProxyList('workers-proxy.shop'),
  ...getDomainProxyList('workers-proxy-1.shop'),
  ...getDomainProxyList('workers-proxy-2.shop'),
];

// 生成从00.到15.的16个二级域名
function getDomainProxyList(domain: string): string[] {
  const list: string[] = [];
  for (let i = 0; i < 16; i++) {
    list.push(`https://${('0' + i).slice(-2)}.${domain}`);
  }
  return list;
}
