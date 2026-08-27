import { cpSync, rmSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = resolve(import.meta.dirname, '..');
const launcherDir = resolve(rootDir, 'launcher');
const wwwSrc = resolve(rootDir, 'www');
const wwwDst = resolve(launcherDir, 'www');
const distDir = resolve(rootDir, 'dist');
const defaultExe = resolve(rootDir, 'DigitShowWebview.exe');

type Target = {
  os: string;
  arch: string;
  arm?: string;
  outputName: string;
  description: string;
};

const TARGETS: Target[] = [
  // Windows
  { os: 'windows', arch: 'amd64', outputName: 'DigitShowWebview-windows-x64.exe', description: 'Windows 64-bit (x64)' },
  { os: 'windows', arch: 'arm64', outputName: 'DigitShowWebview-windows-arm64.exe', description: 'Windows ARM64 (Surface / Snapdragon)' },
  // macOS
  { os: 'darwin', arch: 'arm64', outputName: 'DigitShowWebview-darwin-arm64', description: 'macOS Apple Silicon (M1/M2/M3/M4)' },
  { os: 'darwin', arch: 'amd64', outputName: 'DigitShowWebview-darwin-x64', description: 'macOS Intel 64-bit' },
  // Linux
  { os: 'linux', arch: 'amd64', outputName: 'DigitShowWebview-linux-x64', description: 'Linux 64-bit (x64)' },
  { os: 'linux', arch: 'arm64', outputName: 'DigitShowWebview-linux-arm64', description: 'Linux ARM64 (Raspberry Pi 4/5, Jetson)' },
  { os: 'linux', arch: 'arm', arm: '7', outputName: 'DigitShowWebview-linux-armv7', description: 'Linux ARMv7 32-bit (Raspberry Pi 2/3/Zero)' },
];

console.log('====================================================');
console.log(' [build-all] Multi-platform executable builder');
console.log('====================================================');

// 1. Build frontend
console.log('\n[1/3] Building frontend SPA (www/)...');
const buildRes = spawnSync('bun', ['run', 'build'], {
  cwd: rootDir,
  stdio: 'inherit',
  shell: true,
});
if (buildRes.status !== 0) {
  process.exit(buildRes.status ?? 1);
}

// 2. Prepare staging
console.log('\n[2/3] Staging assets to launcher/www...');
if (existsSync(wwwDst)) {
  rmSync(wwwDst, { recursive: true, force: true });
}
cpSync(wwwSrc, wwwDst, { recursive: true });
mkdirSync(distDir, { recursive: true });

try {
  // 3. Compile all targets
  console.log('\n[3/3] Compiling all OS & architecture targets...\n');
  for (const t of TARGETS) {
    const outPath = resolve(distDir, t.outputName);
    const ldflags = t.os === 'windows' ? '-H windowsgui -s -w' : '-s -w';
    
    console.log(`  -> Building ${t.description.padEnd(45)} => dist/${t.outputName}`);
    
    const env: Record<string, string> = {
      ...process.env,
      GOOS: t.os,
      GOARCH: t.arch,
      CGO_ENABLED: '0',
    };
    if (t.arm) {
      env.GOARM = t.arm;
    }

    const goRes = spawnSync(
      'go',
      ['build', '-ldflags', ldflags, '-o', outPath, 'main.go'],
      {
        cwd: launcherDir,
        stdio: 'inherit',
        env,
      },
    );

    if (goRes.status !== 0) {
      console.error(`[build-all] Failed to build ${t.outputName}`);
      process.exit(goRes.status ?? 1);
    }
  }

  // Copy default windows-x64 exe to root for convenience
  const winX64Path = resolve(distDir, 'DigitShowWebview-windows-x64.exe');
  if (existsSync(winX64Path)) {
    copyFileSync(winX64Path, defaultExe);
  }

  console.log('\n====================================================');
  console.log(` [build-all] All ${TARGETS.length} platform binaries created in dist/`);
  console.log(` Default Windows executable: ${defaultExe}`);
  console.log('====================================================\n');
} finally {
  if (existsSync(wwwDst)) {
    rmSync(wwwDst, { recursive: true, force: true });
  }
}
