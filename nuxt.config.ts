// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2026-04-11',
  devtools: { enabled: true },

  nitro: {
    preset: 'cloudflare_pages',
    cloudflare: {
      nodeCompat: true
    }
  },

  modules: [
    '@nuxt/eslint',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxtjs/tailwindcss',
    'nitro-cloudflare-dev'
  ]
})
