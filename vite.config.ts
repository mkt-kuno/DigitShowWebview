import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    minify: 'esbuild',
    target: 'es2020',
    cssCodeSplit: true,
    cssMinify: true,
    sourcemap: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          uplot: ['uplot']
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
