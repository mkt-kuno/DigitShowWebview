#!/usr/bin/env bun
// Single-binary HTTP server for the SPA.
//
// Compiled with `bun build --compile serve/serve.ts` together with the file
// imports in embedded.generated.ts (see generate-embed.ts). The resulting
// binary embeds every dist/ asset by absolute path; this script reads them via
// Bun.file() and serves them through Bun.serve on 127.0.0.1.
//
// Why loopback only: this server is a stand-in for `vite preview` and the
// custom-domain HTTP deploy. It deliberately refuses to bind a public interface
// — exposing dist/ on the LAN would let any visitor's browser talk to whatever
// HTTP backend they configure in Connection Config without the same-origin
// policy that a real reverse proxy would enforce.
//
// SPA fallback: paths that don't match an embedded asset and don't look like a
// file (no extension in the last segment) get index.html. Anything with a dot
// that isn't an embedded asset is a real 404 — better than masking missing
// bundled files behind a blank page.

import { ASSETS, BASE_PATH } from './embedded.generated';

const DEFAULT_PORT = 8080;
const HOST = '127.0.0.1';

const args = process.argv.slice(2);
let port = DEFAULT_PORT;
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--port' && i + 1 < args.length) {
    const n = Number(args[i + 1]);
    if (!Number.isInteger(n) || n < 1 || n > 65535) {
      console.error(`[serve] invalid --port: ${args[i + 1]}`);
      process.exit(1);
    }
    port = n;
    i++;
  }
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

const mimeFor = (path: string): string => {
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'application/octet-stream';
  return MIME[path.slice(dot).toLowerCase()] ?? 'application/octet-stream';
};

type Asset = { bytes: ArrayBuffer; mime: string };

// Resolve one URL path to either the embedded asset, the SPA fallback, or
// null (which the caller turns into a 404). The bytes are loaded once per
// request via Bun.file(); the file lives in the in-binary overlay filesystem
// `bun build --compile` creates, so each read is a normal file read.
const resolveAsset = async (urlPath: string): Promise<Asset | null> => {
  // Strip the BASE_PATH prefix so requests for "/index.html" and "/"
  // both work regardless of how the SPA was deployed. With BASE_PATH = "/"
  // this is a no-op, but kept for symmetry if a future build wants to mount
  // the SPA under a subpath again.
  let path = urlPath;
  if (BASE_PATH !== '/' && path.startsWith(BASE_PATH)) {
    path = path.slice(BASE_PATH.length - 1);
  }

  const cleanPath = decodeURIComponent(path.split('?')[0]);

  const exact = ASSETS[cleanPath];
  if (exact) {
    const bytes = await Bun.file(exact).arrayBuffer();
    return { bytes, mime: mimeFor(cleanPath) };
  }

  // SPA fallback: serve index.html for any path whose last segment has no
  // file extension. /, /foo, /foo/bar all qualify; /foo.png does not.
  const last = cleanPath.split('/').pop() ?? '';
  if (!last.includes('.')) {
    const indexPath = ASSETS['index.html'];
    if (indexPath) {
      const bytes = await Bun.file(indexPath).arrayBuffer();
      return { bytes, mime: 'text/html; charset=utf-8' };
    }
  }

  return null;
};

const server = Bun.serve({
  hostname: HOST,
  port,
  development: false,
  async fetch(req): Promise<Response> {
    const url = new URL(req.url);
    const asset = await resolveAsset(url.pathname);
    if (!asset) {
      return new Response('Not Found', { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
    return new Response(asset.bytes, {
      headers: {
        'Content-Type': asset.mime,
        // no-cache so reloads after a rebuild pick up new hashed bundles.
        // The browser still revalidates with If-None-Match on every fetch.
        'Cache-Control': 'no-cache',
      },
    });
  },
});

console.log(`[serve] http://${server.hostname}:${server.port}/  (${Object.keys(ASSETS).length} embedded assets)`);

// Single-instance guard: a second `serve` against the same port fails to bind
// and exits. The user can pass --port to run a second copy side by side.
