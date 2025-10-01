export default defineNuxtConfig({
  extends: ['./nuxt.config.ts'],
  sourcemap: false,
  runtimeConfig: {
    debugMpRequest: false,
  },
  nitro: {
    minify: true,
    storage: {
      kv: {
        driver: 'cloudflare-kv-binding',
      },
    },
  },
});
