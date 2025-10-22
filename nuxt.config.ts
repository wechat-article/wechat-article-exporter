import fs from 'node:fs';

export default defineNuxtConfig({
  compatibilityDate: '2024-04-03',
  devtools: {
    enabled: process.env.NODE_ENV !== 'production',
  },
  modules: ['@vueuse/nuxt', '@nuxt/ui', 'nuxt-auth-utils'],
  ssr: false,
  runtimeConfig: {
    public: {
      umamiWebsiteID: '',
      aggridLicense: '',
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
  sourcemap: process.env.NODE_ENV !== 'production',
  nitro: {
    minify: process.env.NODE_ENV === 'production',
    devStorage: {
      kv: {
        driver: 'fs',
        base: '.data/kv',
      },
    },
    storage: {
      kv: {
        driver: process.env.NITRO_KV_DRIVER || 'memory',
        base: process.env.NITRO_KV_BASE || '.data/kv',
      },
    },
    experimental: {
      tasks: true,
    },
    scheduledTasks: {
      // Run `source:sync` task every minute
      '* * * * *': ['source:sync'],
    },
  },
  hooks: {
    ready(nuxt) {
      fs.writeFileSync('nuxt-options.json', JSON.stringify(nuxt.options, null, 2));
    },
  },
});
