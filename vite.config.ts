import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const rootDir = import.meta.dirname;
const pkg = JSON.parse(readFileSync(resolve(rootDir, 'package.json'), 'utf-8'));

// Versions of every declared dependency, read from the installed package in
// node_modules. Injected as VITE_DEP_VERSIONS so the App Info panel's library
// list can never drift from the lockfile.
const DEP_VERSIONS: Record<string, string> = Object.fromEntries(
  Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })
    .map((name) => {
      try {
        const dep = JSON.parse(
          readFileSync(resolve(rootDir, 'node_modules', name, 'package.json'), 'utf-8'),
        );
        return [name, dep.version as string] as const;
      } catch {
        return null;
      }
    })
    .filter((entry): entry is readonly [string, string] => entry !== null),
);

export default defineConfig(() => ({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_DEP_VERSIONS': JSON.stringify(JSON.stringify(DEP_VERSIONS)),
    global: 'globalThis',
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  base: '/digit_show_webview/',
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) {
            return 'react-vendor';
          }
          return 'vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1800,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  preview: {
    port: 4173,
    strictPort: true,
  },
}));