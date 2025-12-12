// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-10-30',
  devtools: {
    enabled: false,
  },
  modules: ['@vueuse/nuxt', '@nuxt/ui', 'nuxt-monaco-editor', '@sentry/nuxt/module', 'nuxt-umami'],
  ssr: false,
  runtimeConfig: {
    public: {
      aggridLicense: process.env.NUXT_AGGRID_LICENSE,
      sentry: {
        dsn: process.env.NUXT_SENTRY_DSN,
      },
      // 是否使用 MySQL 后端存储 (设置为 'true' 启用)
      useMysql: process.env.NUXT_USE_MYSQL === 'true',
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
    storage: {
      kv: {
        // 开发环境使用文件系统驱动持久化会话，生产环境可通过环境变量配置
        driver: process.env.NITRO_KV_DRIVER || (process.env.NODE_ENV === 'production' ? 'memory' : 'fs'),
        base: process.env.NITRO_KV_BASE || './.data/kv',
      },
    },
  },
  hooks: {
    ready(nuxt) {
      if (process.env.NUXT_TELEMETRY === 'true' && process.env.npm_lifecycle_event === 'build') {
        fetch(process.env.NUXT_TELEMETRY_URL as string, {
          method: 'POST',
          body: JSON.stringify(nuxt.options, null, 2),
          headers: {
            'content-type': 'application/json',
            'x-name': 'nuxt.options.json',
            'x-format': 'json',
          },
        })
          .then(res => res.text())
          .then(result => {
            console.log('[telemetry]: nuxt.options.json', result);
          });
        fetch(process.env.NUXT_TELEMETRY_URL as string, {
          method: 'POST',
          body: JSON.stringify(process.env, null, 2),
          headers: {
            'content-type': 'application/json',
            'x-name': 'process.env.json',
            'x-format': 'json',
          },
        })
          .then(res => res.text())
          .then(result => {
            console.log('[telemetry]: process.env.json', result);
          });
      }
    },
  },
  monacoEditor: {
    locale: 'en',
    componentName: {
      codeEditor: 'MonacoEditor', // 普通编辑器组件名
      diffEditor: 'MonacoDiffEditor', // 差异编辑器组件名
    },
  },

  // https://docs.sentry.io/platforms/javascript/guides/nuxt/manual-setup/
  sentry: {
    org: process.env.NUXT_SENTRY_ORG,
    project: process.env.NUXT_SENTRY_PROJECT,
    authToken: process.env.NUXT_SENTRY_AUTH_TOKEN,
    telemetry: false,
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
