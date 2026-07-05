// https://nuxt.com/docs/api/configuration/nuxt-config
const privateDeploymentCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' http://127.0.0.1:* http://localhost:* ws://127.0.0.1:* ws://localhost:* wss://127.0.0.1:* wss://localhost:*",
  "media-src 'self' data: blob: https:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join('; ');

export default defineNuxtConfig({
  compatibilityDate: '2025-10-30',
  hooks: {
    'pages:extend'(pages) {
      if (process.env.NODE_ENV === 'production') {
        const kept = pages.filter(p => {
          const path = p.path ?? '';
          return !(path === '/dev' || path.startsWith('/dev/'));
        });
        pages.splice(0, pages.length, ...kept);
      }
    },
  },
  devtools: {
    enabled: false,
  },
  /** `components/ui/*` 不带 Ui 前缀，保持 ButtonGroup 等名称稳定 */
  components: [
    {
      path: '~/components/ui',
      pathPrefix: false,
    },
  ],
  modules: ['@vueuse/nuxt', '@nuxt/ui'],
  icon: {
    provider: 'server',
    fallbackToApi: false,
    serverBundle: {
      collections: ['heroicons', 'heroicons-solid'],
    },
    clientBundle: {
      scan: true,
    },
  },
  ssr: false,
  runtimeConfig: {
    public: {
      aggridLicense: process.env.NUXT_AGGRID_LICENSE,
      /** true / false：是否跳过「选择文件夹」直接 ZIP；未设时由前端按主机名判断 */
      exportDirectZip: process.env.NUXT_PUBLIC_EXPORT_DIRECT_ZIP,
      /** 文档站根 URL；留空则界面不展示外链（私有化默认） */
      docsWebsiteUrl: process.env.NUXT_PUBLIC_DOCS_WEBSITE_URL ?? '',
      /** wxdown-service 安装包地址；留空则不在界面跳转公网 Releases */
      wxdownReleasesUrl: process.env.NUXT_PUBLIC_WXDOWN_RELEASES_URL ?? '',
      /** 可选：业务指标上报端点（POST JSON），未配置则不上报 */
      metricsEndpoint: process.env.NUXT_PUBLIC_METRICS_ENDPOINT || '',
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
    },
  },
  sourcemap: {
    client: 'hidden',
  },
  nitro: {
    minify: process.env.NODE_ENV === 'production',
    rollupConfig: {
      external: ['puppeteer'],
    },
    storage: {
      kv: {
        driver: process.env.NITRO_KV_DRIVER || 'memory',
        base: process.env.NITRO_KV_BASE,
      },
    },
    routeRules: {
      '/**': {
        headers: {
          'Content-Security-Policy': privateDeploymentCsp,
        },
      },
    },
  },
});
