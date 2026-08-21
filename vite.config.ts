import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { relative, resolve, sep } from 'path';

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

// Inject the full list of built assets into the Service Worker precache list so
// the app shell is cached completely on install and works offline. Without this
// the SW only opportunistically caches assets via its fetch handler, which
// leaves gaps (first load before SW control, freshly hashed bundles after a
// deploy, untriggered lazy chunks) where an offline reload shows a blank page.
function precacheManifest(): Plugin {
  let outDir = 'dist';
  return {
    name: 'precache-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    // closeBundle runs after every output (including the copied public/ dir, so
    // dist/sw.js exists) has been written to disk.
    closeBundle() {
      const dist = resolve(rootDir, outDir);
      const swPath = resolve(dist, 'sw.js');

      const files: string[] = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = resolve(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(relative(dist, full).split(sep).join('/'));
        }
      };
      walk(dist);

      // Precache everything except the SW itself and source maps.
      const manifest = files
        .filter((f) => f !== 'sw.js' && !f.endsWith('.map'))
        .sort();
      const version = createHash('sha256')
        .update(manifest.join('\n'))
        .digest('hex')
        .slice(0, 8);

      const sw = readFileSync(swPath, 'utf-8')
        .replace("const CACHE_VERSION = 'dev';", `const CACHE_VERSION = '${version}';`)
        .replace("const APP_VERSION = '';", `const APP_VERSION = '${pkg.version}';`)
        .replace('const PRECACHE_MANIFEST = [];', `const PRECACHE_MANIFEST = ${JSON.stringify(manifest)};`);
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig(() => ({
  plugins: [react(), precacheManifest()],
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
    'import.meta.env.VITE_DEP_VERSIONS': JSON.stringify(JSON.stringify(DEP_VERSIONS)),
    global: 'globalThis',
    'process.env.DRAGGABLE_DEBUG': 'false',
  },
  base: '/DigitShowWebview/',
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