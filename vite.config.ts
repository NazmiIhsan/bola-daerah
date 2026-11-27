import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const UI = 'src/ui/**/*.test.{ts,tsx}'

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      // Ask before swapping in a new version, so nobody loses a match in progress.
      registerType: 'prompt',
      includeAssets: ['apple-touch-icon.png'],
      manifest: {
        name: 'Bola Daerah',
        short_name: 'Bola Daerah',
        description: 'Football management, Selangor style',
        lang: 'ms',
        start_url: './',
        scope: './',
        display: 'standalone',
        theme_color: '#c8102e',
        background_color: '#f4f1ea',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { globPatterns: ['**/*.{js,css,html,png,svg,woff2}'] },
    }),
  ],
  test: {
    globals: true,
    css: { include: [/\.css\?raw$/] },
    setupFiles: ['src/test/setup.ts'],
    projects: [
      { extends: true, test: { name: 'game', environment: 'node', include: ['src/**/*.test.{ts,tsx}'], exclude: [UI] } },
      { extends: true, test: { name: 'ui', environment: 'jsdom', include: [UI] } },
    ],
  },
})
