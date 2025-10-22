export default defineNuxtConfig({
    compatibilityDate: '2024-04-03',
    devtools: {enabled: false},
    modules: ['@vueuse/nuxt', '@nuxt/ui', 'nuxt-auth-utils'],
    ssr: false,
    runtimeConfig: {
        public: {
            umamiWebsiteID: '',
            aggridLicense: '',
        },
        debugMpRequest: true,
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
    sourcemap: true,
    nitro: {
        devStorage: {
            kv: {
                driver: 'fs',
                base: '.data/kv',
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
});
