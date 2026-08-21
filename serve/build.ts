#!/usr/bin/env bun
// Build the standalone serve binary.
//
//   bun run serve:build
//
// Three steps, all from the repo root:
//
//   1. `bun run build`  — type-check + Vite production build into dist/
//   2. generate-embed   — emit embedded.generated.ts with one file-import per
//                          asset, so the compiled binary can inline them
//   3. bun build --compile serve/serve.ts — produce the single executable
//
// The output goes to serve/bin/serve (or .exe on Windows). The .gitignore
// covers both serve/bin/ and serve/embedded.generated.ts.

import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SERVE_DIR = resolve(ROOT, 'serve');
const BIN_DIR = resolve(SERVE_DIR, 'bin');
const ENTRY = resolve(SERVE_DIR, 'serve.ts');

const ext = process.platform === 'win32' ? '.exe' : '';
const out = resolve(BIN_DIR, `serve${ext}`);

const run = (cmd: readonly string[], label: string): void => {
  console.log(`\n[serve:build] ${label}`);
  const proc = Bun.spawnSync({
    cmd,
    cwd: ROOT,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  if (proc.exitCode !== 0) {
    console.error(`[serve:build] step failed: ${label} (exit ${proc.exitCode})`);
    process.exit(proc.exitCode ?? 1);
  }
};

// 1. SPA build.
run(['bun', 'run', 'build'], '1/3 build dist/');

// 2. Emit the file-import module from the current dist/.
run(['bun', 'run', 'serve/generate-embed.ts'], '2/3 generate embedded.generated.ts');

if (!existsSync(ENTRY)) {
  console.error(`[serve:build] entry not found: ${ENTRY}`);
  process.exit(1);
}

mkdirSync(BIN_DIR, { recursive: true });

// 3. Compile to a single executable.
run(
  ['bun', 'build', '--compile', '--target=bun', ENTRY, '--outfile', out],
  `3/3 compile to ${out}`,
);

console.log(`\n[serve:build] done. Run ./serve/bin/serve${ext}`);
console.log(`[serve:build] Pass --port <n> to override the default 8080.`);
