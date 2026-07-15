export type MissingBackgroundResourceHandler = (url: string) => void;

export type NormalizedHtmlDocumentOptions = {
  title: string;
  localLinks: string;
  bodyClass: string;
  pageContentHTML: string;
  jsArticleBottomBarHTML?: string;
  commentHTML: string;
};

const backgroundResourceUrlPattern =
  /((?:background|background-image): url\((?:&quot;)?)((?:https?|\/\/)[^)]+?)((?:&quot;)?\))/gs;

export function rewriteBackgroundResourceUrls(
  html: string,
  urlmap: Map<string, string>,
  onMissing?: MissingBackgroundResourceHandler
): string {
  return html.replaceAll(backgroundResourceUrlPattern, (_match: string, prefix: string, url: string, suffix: string) => {
    if (urlmap.has(url)) {
      const path = urlmap.get(url)!;
      return `${prefix}./${path}${suffix}`;
    }

    onMissing?.(url);
    return `${prefix}${url}${suffix}`;
  });
}

export function buildNormalizedHtmlDocument(options: NormalizedHtmlDocumentOptions): string {
  return `<!DOCTYPE html>
<html lang="zh_CN">
<head>
    <meta charset="utf-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=0,viewport-fit=cover">
    <title>${options.title}</title>
    ${options.localLinks}
    <style>
        #page-content,
        #js_article_bottom_bar,
        .__page_content__ {
            max-width: 667px;
            margin: 0 auto;
        }
        img {
            max-width: 100%;
        }
        .sns_opr_btn::before {
            width: 16px;
            height: 16px;
            margin-right: 3px;
        }
    </style>
</head>
<body class="${options.bodyClass}">
${options.pageContentHTML}
${options.jsArticleBottomBarHTML}

<!-- 评论数据 -->
${options.commentHTML}
</body>
</html>`;
}
