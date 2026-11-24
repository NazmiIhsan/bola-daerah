/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './',
  plugins: [react()],
  test: {
    globals: true,
    css: { include: [/\.css\?raw$/] },
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    environmentMatchGlobs: [['src/ui/**', 'jsdom']],
  },
})
