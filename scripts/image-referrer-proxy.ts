/**
 * Author: jock
 * Date: 2024-11-16
 * Description: 解决图片防盗链问题，只允许 localhost 和 wechat-article-exporter.deno.dev 这两个域使用该代理服务。
 */


function error(msg: string, status = 400) {
    return new Response(msg, {
        status: status,
    });
}

const ORIGIN_WHITELIST = ['localhost', 'wechat-article-exporter.deno.dev']
const REFERER_WHITELIST = ['localhost', 'wechat-article-exporter.deno.dev']

Deno.serve(async (req: Request, info: Deno.ServeHandlerInfo) => {
    try {
        const origin = req.headers.get("origin")!;
        const referer = req.headers.get("referer")!;
        if (!referer) {
            console.log('referer 为空')
            return error('not fouond', 404)
        }
        if (origin && !ORIGIN_WHITELIST.includes(new URL(origin).hostname)) {
            console.log(`origin(${origin}) 不在白名单`)
            return error('not found', 404)
        }
        if (!REFERER_WHITELIST.includes(new URL(referer).hostname)) {
            console.log(`referer(${referer}) 不在白名单`)
            return error('not found', 404)
        }

        let targetURL: string
        const { searchParams } = new URL(req.url);
        if (searchParams.has("url")) {
            targetURL = decodeURIComponent(searchParams.get("url")!);
        }

        if (!targetURL) {
            throw new Error("URL not found");
        }
        if (!/^https?:\/\//.test(targetURL)) {
            throw new Error("URL not valid");
        }

        const response = await fetch(targetURL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36",
                Referer: "https://mp.weixin.qq.com",
            }
        })

        return new Response(response.body, {
            headers: {
                "Access-Control-Allow-Origin": origin,
                "Content-Type": response.headers.get("Content-Type")!,
            },
        });
    } catch (err: any) {
        return error(err.message);
    }
});
