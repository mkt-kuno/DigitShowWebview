import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: true,
    sourcemap: false,
    target: 'es2020'
  },
  server: {
    proxy: {
      '/v1': {
        target: 'http://localhost:80',
        changeOrigin: true,
      }
    }
  },
  css: {
    postcss: './postcss.config.js',
  }
})
