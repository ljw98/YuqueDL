// https://nuxt.com/docs/api/configuration/nuxt-config
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const rootDir = dirname(fileURLToPath(import.meta.url))
const dataDir = resolve(rootDir, '../data')

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
    public: {
      appName: '语雀下载器',
    },
  },
  nitro: {
    experimental: {
      tasks: false,
    },
  },
  app: {
    head: {
      title: '语雀下载器',
      meta: [
        { name: 'description', content: '语雀知识库可视化下载与预览' },
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
