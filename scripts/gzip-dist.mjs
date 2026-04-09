import { createGzip } from 'node:zlib';
import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';

const DIST_DIR = 'dist';
const GZIP_EXTENSIONS = new Set([
  '.html',
  '.js',
  '.css',
  '.svg',
  '.json',
  '.txt',
  '.xml',
  '.wasm'
]);

const listFiles = async (dir) => {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(fullPath);
    return [fullPath];
  }));
  return files.flat();
};

const gzipFile = async (filePath) => {
  const gzPath = `${filePath}.gz`;
  await fs.mkdir(dirname(gzPath), { recursive: true });

  await pipeline(
    createReadStream(filePath),
    createGzip({ level: 9 }),
    createWriteStream(gzPath)
  );

  const [srcStat, gzStat] = await Promise.all([fs.stat(filePath), fs.stat(gzPath)]);
  return { filePath, srcBytes: srcStat.size, gzBytes: gzStat.size };
};

const main = async () => {
  const allFiles = await listFiles(DIST_DIR);
  const targets = allFiles.filter((file) => GZIP_EXTENSIONS.has(extname(file)) && !file.endsWith('.gz'));

  const results = [];
  for (const target of targets) {
    results.push(await gzipFile(target));
  }

  const totalSrc = results.reduce((sum, r) => sum + r.srcBytes, 0);
  const totalGz = results.reduce((sum, r) => sum + r.gzBytes, 0);
  const saved = totalSrc - totalGz;

  console.log(`gzipped ${results.length} files`);
  console.log(`total: ${totalSrc} -> ${totalGz} bytes (saved ${saved} bytes)`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
