import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild',
    target: 'esnext',
    modulePreload: false,
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('react-plotly.js') || id.includes('plotly.js/lib/')) {
            return 'plotly';
          }
          if (id.includes('react-dom') || id.includes('react')) {
            return 'react';
          }
        }
      }
    }
  },
  esbuild: {
    drop: ['console', 'debugger']
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
