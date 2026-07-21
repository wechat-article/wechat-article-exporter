// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-10-30',
  devtools: {
    enabled: false,
  },
  modules: ['@vueuse/nuxt', '@nuxt/ui', 'nuxt-monaco-editor', 'nuxt-umami'],
  ssr: false,
  runtimeConfig: {
    public: {
      aggridLicense: process.env.NUXT_AGGRID_LICENSE,
      // 会员/限速层（仅公开托管用；默认关闭，fork 私有部署无限速、无付费 UI）
      membership: {
        enabled: process.env.NUXT_PUBLIC_MEMBERSHIP_ENABLED === 'true',
        price: process.env.NUXT_PUBLIC_MEMBERSHIP_PRICE || '0.5',
        wechatNote: process.env.NUXT_PUBLIC_MEMBERSHIP_WECHAT_NOTE || 'API 会员',
        qr: process.env.NUXT_PUBLIC_MEMBERSHIP_QR || '/images/member-wechat-qr.png',
      },
    },
    debugMpRequest: false,
  },
  app: {
    head: {
      meta: [
        {
          name: 'referrer',
          content: 'no-referrer',
        },
      ],
      script: [
        {
          src: '/vendors/html-docx-js@0.3.1/html-docx.js',
          defer: true,
        },
      ],
    },
  },
  sourcemap: {
    client: 'hidden',
  },
  nitro: {
    minify: process.env.NODE_ENV === 'production',
    // 开启 wasm 支持（unwasm）：cgi 沙箱 @cf-wasm/quickjs 以 import 方式引入 .wasm 模块，
    // 需要该插件处理（含 edge/CF 约定的 `.wasm?module` 后缀），否则 rollup 无法加载 wasm。
    experimental: {
      wasm: true,
    },
    rollupConfig: {
      external: ['puppeteer'],
    },
    storage: {
      kv: {
        driver: process.env.NITRO_KV_DRIVER || 'memory',
        // cloudflare-kv-binding 驱动使用；Workers 部署时对应 wrangler.toml 中的 KV 绑定名。
        // fs / memory 驱动会忽略该选项，因此对 Docker / 本地 dev 无影响。
        binding: 'KV',
        // base 对 fs 驱动是存储目录(.data/kv)；但对 cloudflare-kv-binding 会变成键前缀，
        // 导致读到 `.data/kv:member:xxx` 而非 `member:xxx` → 键不匹配。故 CF 下不加 base。
        base: process.env.NITRO_KV_DRIVER === 'cloudflare-kv-binding' ? undefined : process.env.NITRO_KV_BASE,
      },
    },
  },
  monacoEditor: {
    locale: 'en',
    componentName: {
      codeEditor: 'MonacoEditor', // 普通编辑器组件名
      diffEditor: 'MonacoDiffEditor', // 差异编辑器组件名
    },
  },

  // https://umami.nuxt.dev/api/configuration
  umami: {
    enabled: true,
    id: process.env.NUXT_UMAMI_ID,
    host: process.env.NUXT_UMAMI_HOST,
    domains: ['down.mptext.top'],
    ignoreLocalhost: true,
    autoTrack: true,
    logErrors: true,
  },
});
