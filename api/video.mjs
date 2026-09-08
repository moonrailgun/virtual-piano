import { mkdtemp, rm } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { importVideo } from '../server/video-import.mjs';

const errors = { videoInvalid: 400, videoIncomplete: 422, videoTooLarge: 413, videoUnavailable: 502 };
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.writeHead(405, { Allow: 'GET' }).end(); return; }
  const controller = new AbortController();
  const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(280000)]);
  const disconnect = () => controller.abort();
  res.on('close', disconnect);
  let directory;
  try {
    let url;
    try { url = new URL(new URL(req.url, 'http://localhost').searchParams.get('url')); }
    catch { throw new Error('videoInvalid'); }
    directory = await mkdtemp(path.join(tmpdir(), 'piano-video-'));
    const audio = await importVideo(url, directory, signal);
    res.writeHead(200, { 'Content-Type': 'audio/mp4', 'X-Content-Type-Options': 'nosniff', 'X-Audio-Title': encodeURIComponent([...audio.title].slice(0, 200).join('')), 'X-Audio-Duration': String(audio.duration) });
    // Stream the verified file to avoid Vercel's buffered response limit.
    await pipeline(createReadStream(audio.file), res, { signal });
  } catch (error) {
    if (!res.destroyed && !res.headersSent) {
      const code = Object.hasOwn(errors, error.message) ? error.message : 'videoUnavailable';
      res.writeHead(errors[code], { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: code }));
    } else if (!res.destroyed) res.destroy();
  } finally {
    controller.abort();
    res.off('close', disconnect);
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
