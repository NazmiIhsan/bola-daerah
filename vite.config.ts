import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const UI = 'src/ui/**/*.test.{ts,tsx}'

export default defineConfig({
  base: './',
  plugins: [react()],
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
