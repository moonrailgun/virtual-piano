import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, chmod } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Official standalone releases include Python and YouTube's EJS solver.
const version = '2026.08.19';
const releases = {
  darwin: ['yt-dlp_macos', '0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202'],
  'linux-x64': ['yt-dlp_linux', '58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a'],
  'linux-arm64': ['yt-dlp_linux_aarch64', 'b16e4dab368a816cd05d477d698a605a6ae87ccee1c8ffd38fa21d7254141fcc'],
};
const release = releases[process.platform === 'darwin' ? 'darwin' : `${process.platform}-${process.arch}`];
if (!release) throw new Error('Video import supports macOS and Linux.');
const destination = fileURLToPath(new URL('../bin/yt-dlp', import.meta.url));
const digest = buffer => createHash('sha256').update(buffer).digest('hex');
const existing = await readFile(destination).catch(() => null);
if (!existing || digest(existing) !== release[1]) {
  const response = await fetch(`https://github.com/yt-dlp/yt-dlp/releases/download/${version}/${release[0]}`, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`yt-dlp download failed: ${response.status}`);
  const binary = Buffer.from(await response.arrayBuffer());
  if (digest(binary) !== release[1]) throw new Error('yt-dlp checksum mismatch');
  await mkdir(new URL('../bin/', import.meta.url), { recursive: true });
  await writeFile(destination, binary);
}
await chmod(destination, 0o755);
console.log(`Video importer ready: yt-dlp ${version}`);
