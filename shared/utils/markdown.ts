import TurndownService from 'turndown';

/**
 * 创建配置好的 Turndown 实例
 *
 * 传入的是完整 HTML 文档，Turndown 解析时 <head> 标签本身会被丢弃，
 * 但其中 <style>/<title> 等元素会作为节点残留，默认规则会把它们的文本
 * 原样输出，导致整段 CSS 混入 Markdown 正文，因此需要显式移除。
 */
export function createTurndownService() {
  const service = new TurndownService({
    headingStyle: 'atx',
    bulletListMarker: '-',
    codeBlockStyle: 'fenced',
  });

  service.remove(['style', 'script', 'noscript', 'link', 'meta', 'title']);

  // 移除底部操作栏（阅读/赞/分享/推荐/留言），其图标是内联 data URI，转换后是大段乱码
  service.remove(node => {
    const className = node.getAttribute?.('class') || '';
    return className.includes('__bottom-bar__');
  });

  return service;
}
