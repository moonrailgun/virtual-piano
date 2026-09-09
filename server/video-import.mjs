import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import ffmpeg from 'ffmpeg-static';
import { videoProxy, publicAddress } from './video-proxy.mjs';
import { bilibiliAudio } from './bilibili.mjs';

export const maxBytes = 100 * 1024 * 1024;
export function checkDuration(expected, actual = expected) {
  if (!Number.isFinite(expected) || expected <= 0) throw new Error('videoUnavailable');
  if (expected > 20 * 60) throw new Error('videoTooLarge');
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > 2) throw new Error('videoIncomplete');
}

async function run(command, args, signal, env = process.env) {
  let child;
  const kill = () => { if (child?.pid) { try { process.kill(-child.pid, 'SIGKILL'); } catch {} } };
  try {
    const promise = promisify(execFile)(command, args, { signal, env, detached: true, maxBuffer: 8 * 1024 * 1024 });
    child = promise.child;
    signal.addEventListener('abort', kill, { once: true });
    if (signal.aborted) kill();
    return (await promise).stdout;
  } finally { signal.removeEventListener('abort', kill); kill(); }
}

export async function importVideo(url, directory, signal) {
  await publicAddress(url);
  const proxy = await videoProxy(signal);
  const controller = new AbortController();
  const downloadSignal = AbortSignal.any([signal, controller.signal]);
  let tooLarge = false;
  const sizeCheck = setInterval(async () => {
    try {
      const sizes = await Promise.all((await readdir(directory)).map(async file => (await stat(path.join(directory, file))).size));
      if (sizes.reduce((sum, size) => sum + size, 0) > maxBytes) { tooLarge = true; controller.abort(); }
    } catch {}
  }, 500);
  const executable = path.join(process.cwd(), 'bin/yt-dlp');
  // urllib and other downloader clients must not bypass the guard for redirect targets.
  const env = { ...process.env, no_proxy: '', NO_PROXY: '', http_proxy: proxy.url, HTTP_PROXY: proxy.url, https_proxy: proxy.url, HTTPS_PROXY: proxy.url, all_proxy: proxy.url, ALL_PROXY: proxy.url };
  const args = ['--ignore-config', '--no-plugin-dirs', '--no-playlist', '--playlist-items', '1', '--no-cache-dir', '--no-warnings', '--no-progress', '--no-remote-components', '--js-runtimes', `node:${process.execPath}`, '--proxy', proxy.url, '--socket-timeout', '20', '--retries', '1', '--fragment-retries', '1', '--abort-on-unavailable-fragments', '--downloader', 'native', '--hls-prefer-native', '--fixup', 'never', '--max-filesize', String(maxBytes), '--format', 'bestaudio/best[height<=480]/best'];
  try {
    const bilibili = ['bilibili.com', 'www.bilibili.com', 'm.bilibili.com'].includes(url.hostname);
    const info = bilibili
      ? await bilibiliAudio(url, downloadSignal)
      : JSON.parse(await run(executable, [...args, '--dump-single-json', '--skip-download', '--', url.href], downloadSignal, env));
    const directAudio = info.extractor_key === 'Generic' && info.vcodec === 'none' && ['http', 'https'].includes(info.protocol);
    if (info.duration != null || !directAudio) checkDuration(info.duration);
    if (info.is_live || info._type === 'playlist' || !['http', 'https', 'm3u8_native', 'http_dash_segments'].includes(info.protocol)) throw new Error('videoUnavailable');
    const metadata = path.join(directory, 'info.json');
    await writeFile(metadata, JSON.stringify(info));
    // Let yt-dlp skip blocked Bilibili CDNs; keep its probe files in writable temporary storage.
    await run(executable, [...args, ...(bilibili ? ['--check-formats', '--paths', `temp:${directory}`] : []), '--load-info-json', metadata, '--output', path.join(directory, 'source.%(ext)s')], downloadSignal, env);
    const files = (await readdir(directory)).filter(file => file.startsWith('source.') && !file.endsWith('.part') && !file.endsWith('.ytdl'));
    if (files.length !== 1) throw new Error('videoIncomplete');
    const source = path.join(directory, files[0]);
    const sourceSize = (await stat(source)).size;
    if (!sourceSize) throw new Error('videoIncomplete');
    if (sourceSize > maxBytes) throw new Error('videoTooLarge');
    const output = path.join(directory, 'audio.m4a');
    const progress = await run(ffmpeg, ['-nostdin', '-hide_banner', '-v', 'error', '-xerror', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'mov,matroska,webm,ogg,mp3,aac,flac,wav,mpegts', '-i', source, '-map', '0:a:0', '-vn', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-progress', 'pipe:1', '-nostats', output], downloadSignal);
    const elapsed = [...progress.matchAll(/^out_time_us=(\d+)$/gm)].at(-1)?.[1];
    const duration = info.duration ?? Number(elapsed) / 1e6;
    checkDuration(duration, Number(elapsed) / 1e6);
    const size = (await stat(output)).size;
    if (!size) throw new Error('videoIncomplete');
    if (size > maxBytes) throw new Error('videoTooLarge');
    return { file: output, title: info.title || url.hostname, duration };
  } catch (error) {
    if (tooLarge) throw new Error('videoTooLarge');
    throw error;
  } finally { clearInterval(sizeCheck); proxy.close(); }
}
