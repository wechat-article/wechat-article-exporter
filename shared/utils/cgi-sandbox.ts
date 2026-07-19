// Dynamic Workers（worker_loader）内置沙箱：在断网的独立 V8 isolate 里执行微信文章的 cgi 脚本，
// 取回 window.cgiDataNew。从 html.ts 抽出，避免与 HTML 处理逻辑混杂。
// 仅用 crypto.subtle / 传入的 loader（web 标准），不含服务端专有依赖，客户端也可安全打包。

// Dynamic Workers（worker_loader）绑定的最小类型（完整类型见 CF 运行时 WorkerLoader）
export interface WorkerLoaderLike {
  get(
    id: string,
    getCode: () => Promise<{
      compatibilityDate: string;
      mainModule: string;
      modules: Record<string, string>;
      env?: Record<string, unknown>;
      globalOutbound?: unknown | null;
    }>,
  ): { getEntrypoint(): { fetch(url: string): Promise<Response> } };
}

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 在断网的 Dynamic Worker 沙箱（独立 V8 isolate）里执行 cgi 脚本，取回 window.cgiDataNew。
 * globalOutbound:null 断网、不传 binding → 纯函数沙箱，用户代码碰不到宿主环境。
 * @param loader Dynamic Workers 绑定（来自 event.context.cloudflare.env.LOADER）
 * @param code   从文章 html 提取出的 cgi 脚本（window.cgiDataNew = {...}）
 * @return window.cgiDataNew 对象，执行出错时返回 null
 */
export async function evalCgiViaLoader(loader: WorkerLoaderLike, code: string): Promise<any> {
  const generatedModule = `
export default {
  async fetch() {
    const window = {};
    const console = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
    let executionError = null;
    try {
      await (async function () {
${code}
      }).call(window);
    } catch (err) {
      executionError = (err && err.message) ? err.message : String(err);
    }
    let body;
    try { body = JSON.stringify({ executionError, window }); }
    catch { body = JSON.stringify({ executionError: executionError || 'serialize failed', window: {} }); }
    return new Response(body, { headers: { 'Content-Type': 'application/json' } });
  }
};`;
  // id = 代码哈希：相同文章脚本复用 warm isolate（更快 + 按唯一 worker/天 计费去重）
  const id = 'cgi:' + (await sha256Hex(code));
  const worker = loader.get(id, async () => ({
    compatibilityDate: '2025-05-01',
    mainModule: 'eval.js',
    modules: { 'eval.js': generatedModule },
    env: {},
    globalOutbound: null,
  }));
  const resp = await worker.getEntrypoint().fetch('https://cgi.internal/');
  const data: any = await resp.json();
  return data && data.executionError === null ? data.window.cgiDataNew : null;
}
