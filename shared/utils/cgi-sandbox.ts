// QuickJS-WASM 沙箱：在一个不联网、无宿主能力的 QuickJS isolate 里执行微信文章的 cgi 脚本，
// 取回 window.cgiDataNew。运行在主 Worker 内（普通 Workers 计费），替代原先的 Dynamic Workers
// （worker_loader），后者按「每天唯一 worker」计费、每篇文章脚本都算新 worker，成本高昂。
//
// 依赖 @cf-wasm/quickjs 的 export conditions：node 环境解析到 /node 入口，workerd(CF) 解析到 /workerd 入口，
// wasm 由该包自动打包。默认不向被执行代码暴露任何宿主 API（无网络、无绑定），安全性与旧沙箱等价。
//
// 该文件含 wasm 依赖，仅供服务端使用；html.ts 用 `import.meta.server` 守卫的动态 import 引入它，
// 确保它不会被打进纯客户端 SPA bundle。
import { getQuickJSWASMModule, type QuickJSWASMModule, shouldInterruptAfterDeadline } from '@cf-wasm/quickjs';

// 执行超时（毫秒）：防御性上限，防止异常脚本卡死 isolate。
const EVAL_DEADLINE_MS = 2000;

// 模块级单例：WASM 模块只实例化一次，跨请求复用（每次调用仅新建/销毁一个轻量 context）。
let modulePromise: Promise<QuickJSWASMModule> | null = null;
function getModule(): Promise<QuickJSWASMModule> {
  if (!modulePromise) {
    modulePromise = getQuickJSWASMModule();
  }
  return modulePromise;
}

/**
 * 在 QuickJS 沙箱里执行 cgi 脚本，取回 window.cgiDataNew。
 * 沙箱内只提供最小的 window / console，不暴露宿主环境（无网络、无绑定）。
 * @param code 从文章 html 提取出的 cgi 脚本（内部定义 JsDecode 并赋值 window.cgiDataNew = {...}）
 * @return window.cgiDataNew 对象，执行出错时返回 null
 */
export async function evalCgiViaQuickJS(code: string): Promise<any> {
  const QuickJS = await getModule();
  const ctx = QuickJS.newContext();
  try {
    ctx.runtime.setInterruptHandler(shouldInterruptAfterDeadline(Date.now() + EVAL_DEADLINE_MS));

    // 在 isolate 内构造最小沙箱：以局部 window 作为脚本的 this 与全局对象，执行后把结果 JSON 序列化回宿主。
    // JSON.stringify 在 isolate 内完成 → 宿主 JSON.parse，天然处理超大 content_noencode 字符串、丢弃函数/undefined。
    const wrapper = `(function () {
  var window = {};
  var console = { log() {}, info() {}, warn() {}, error() {}, debug() {} };
  var executionError = null;
  try {
    (function () {
${code}
    }).call(window);
  } catch (err) {
    executionError = (err && err.message) ? err.message : String(err);
  }
  var cgiData = (executionError === null && window.cgiDataNew !== undefined) ? window.cgiDataNew : null;
  try { return JSON.stringify({ executionError: executionError, cgiData: cgiData }); }
  catch (e) { return JSON.stringify({ executionError: executionError || 'serialize failed', cgiData: null }); }
})()`;

    const result = ctx.evalCode(wrapper);
    if (result.error) {
      const detail = ctx.dump(result.error);
      result.error.dispose();
      console.error('QuickJS 执行 cgi 脚本失败:', detail);
      return null;
    }
    const jsonStr: string = ctx.dump(result.value);
    result.value.dispose();

    const parsed = JSON.parse(jsonStr);
    return parsed.executionError === null ? parsed.cgiData : null;
  } catch (error) {
    console.error(error);
    return null;
  } finally {
    ctx.dispose();
  }
}
