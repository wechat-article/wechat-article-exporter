export interface ExportResourceRef {
  url: string;
  fakeid: string;
}

type ResourceDocument = Pick<Document, 'querySelectorAll'>;

const BACKGROUND_RESOURCE_RE =
  /((?:background|background-image): url\((?:&quot;)?)((?:https?|\/\/)[^)]+?)((?:&quot;)?\))/gs;

export function collectBackgroundResourceUrls(html: string): string[] {
  const urls: string[] = [];
  html.replaceAll(BACKGROUND_RESOURCE_RE, (_, p1, url, p3) => {
    urls.push(url);
    return `${p1}${url}${p3}`;
  });
  return urls;
}

export function collectArticleResourceUrls(html: string, document: ResourceDocument): string[] {
  const resources: string[] = [];

  const imgs = document.querySelectorAll<HTMLImageElement>('img');
  for (const img of imgs) {
    const imgUrl = img.getAttribute('src') || img.getAttribute('data-src');
    if (imgUrl) {
      resources.push(imgUrl);
    }
  }

  const links = document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]');
  for (const link of links) {
    const url = link.href;
    if (url) {
      resources.push(url);
    }
  }

  resources.push(...collectBackgroundResourceUrls(html));
  return resources;
}

export function createExportResourceRefs(resources: readonly string[], fakeid: string): ExportResourceRef[] {
  return resources.map(url => ({ url, fakeid }));
}
