import { cpSync, rmSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(import.meta.dirname, '..');
const launcherDir = resolve(rootDir, 'launcher');
const wwwSrc = resolve(rootDir, 'www');
const wwwDst = resolve(launcherDir, 'www');
const outExe = resolve(rootDir, 'DigitShowWebview.exe');

// 1. Build frontend if needed
console.log('[build-exe] Building frontend...');
const buildRes = spawnSync('bun', ['run', 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});
if (buildRes.status !== 0) {
  process.exit(buildRes.status ?? 1);
}

// 2. Stage www/ inside launcher/ for go:embed
console.log('[build-exe] Staging assets to launcher/www...');
if (existsSync(wwwDst)) {
  rmSync(wwwDst, { recursive: true, force: true });
}
cpSync(wwwSrc, wwwDst, { recursive: true });

try {
  // 3. Compile Go binary (cross-compiles to Windows by default)
  console.log('[build-exe] Compiling Go launcher (GOOS=windows, GOARCH=amd64)...');
  const goRes = spawnSync(
    'go',
    ['build', '-ldflags', '-H windowsgui -s -w', '-o', outExe, 'main.go'],
    {
      cwd: launcherDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        GOOS: process.env.GOOS || 'windows',
        GOARCH: process.env.GOARCH || 'amd64',
        CGO_ENABLED: '0',
      },
    },
  );

  if (goRes.status !== 0) {
    process.exit(goRes.status ?? 1);
  }
  console.log(`[build-exe] Output: ${outExe}`);
} finally {
  // 4. Always clean up staged launcher/www
  if (existsSync(wwwDst)) {
    rmSync(wwwDst, { recursive: true, force: true });
  }
}
