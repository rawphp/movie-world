import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node', // component tests opt into jsdom via // @vitest-environment jsdom
    include: ['src/**/__tests__/**/*.test.ts']
  },
  resolve: {
    alias: { '@renderer': '/src/renderer/src', '@shared': '/src/shared' }
  }
})
