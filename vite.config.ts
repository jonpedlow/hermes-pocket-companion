import { defineConfig } from 'vite'

export default defineConfig({
  build: { license: { fileName: 'licenses/browser-packages.md' } },
  server: {
    proxy: {
      '/api': { target: 'http://127.0.0.1:4177', changeOrigin: true, ws: true }
    }
  }
})
