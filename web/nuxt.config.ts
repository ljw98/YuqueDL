// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
// Default next to monorepo root; Docker/runtime can override via YUQUE_DL_DATA
const dataDir = resolve(process.env.YUQUE_DL_DATA || resolve(rootDir, '../data'))

export default defineNuxtConfig({
  compatibilityDate: '2025-01-01',
  devtools: { enabled: false },
  ssr: false,
  modules: ['@element-plus/nuxt'],
  elementPlus: {
    importStyle: 'css',
  },
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    dataDir,
    downloadsDir: resolve(dataDir, 'downloads'),
    jobsFile: resolve(dataDir, 'jobs.json'),
    settingsFile: resolve(dataDir, 'settings.json'),
    schedulesFile: resolve(dataDir, 'schedules.json'),
    // optional hard access password via env: YUQUE_DL_ACCESS_PASSWORD / NUXT_ACCESS_PASSWORD
    accessPassword: process.env.YUQUE_DL_ACCESS_PASSWORD || '',
    // optional secret via env: YUQUE_DL_SECRET / NUXT_AUTH_SECRET
    authSecret: process.env.YUQUE_DL_SECRET || '',
    // optional absolute path to yuque-dl core entry
    coreEntry: process.env.YUQUE_DL_CORE || resolve(rootDir, '../dist/es/index.js'),
    public: {
      appName: '语雀下载器',
    },
  },
  nitro: {
    experimental: {
      tasks: false,
    },
    routeRules: {
      '/**': {
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
          'X-DNS-Prefetch-Control': 'off',
        },
      },
      '/api/**': {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'SAMEORIGIN',
          'Referrer-Policy': 'strict-origin-when-cross-origin',
        },
      },
    },
  },
  app: {
    head: {
      title: '语雀下载器',
      meta: [
        { name: 'description', content: '语雀知识库可视化下载与预览' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1, user-scalable=no' },
        { name: 'theme-color', content: '#5BD171' },
        { name: 'mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
        { name: 'format-detection', content: 'telephone=no' },
      ],
      link: [
        // SVG 优先；ICO/PNG 兜底兼容旧浏览器与 iOS 书签
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg?v=4' },
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico?v=4' },
        { rel: 'shortcut icon', href: '/favicon.ico?v=4' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png?v=4' },
      ],
    },
  },
  vite: {
    server: {
      watch: {
        ignored: ['**/data/**', '**/node_modules/**'],
      },
    },
  },
})
