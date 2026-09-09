import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bilibiliAudio } from '../server/bilibili.mjs';

test('Bilibili resolves a full CDN track or MP4, selects the part and rejects previews', async t => {
  const calls: URL[] = [];
  let playback: any = { dash: { duration: 250, audio: [{ codecs: 'mp4a.40.2', bandwidth: 128000, baseUrl: 'https://peer.mcdn.bilivideo.cn:8082/song.m4s', backupUrl: ['https://audio.bilivideo.com/song.m4s'] }] } };
  t.mock.method(globalThis, 'fetch', async (input: string, options: RequestInit) => {
    const url = new URL(input);
    calls.push(url);
    assert.equal(options.redirect, 'error');
    if (url.pathname.endsWith('/view')) return Response.json({ code: 0, data: { title: '测试曲目', pages: [{ cid: 1, duration: 30 }, { cid: 2, duration: 250, part: '第二段' }] } });
    return Response.json({ code: 0, data: playback });
  });
  const resolve = (url = 'https://www.bilibili.com/video/BV1geYJ6xE5E?p=2') => bilibiliAudio(new URL(url), new AbortController().signal);
  for (const url of ['https://example.com/video/BV1geYJ6xE5E', 'https://www.bilibili.com.evil.test/video/BV1geYJ6xE5E', 'https://user@www.bilibili.com/video/BV1geYJ6xE5E', 'https://www.bilibili.com/video/BV1geYJ6xE5E?p=-1']) await assert.rejects(resolve(url), /videoInvalid/);
  assert.equal(calls.length, 0);
  const audio = await resolve();
  assert.equal(audio.url, 'https://audio.bilivideo.com/song.m4s');
  assert.equal(audio.title, '测试曲目 · 第二段');
  assert.equal(audio.duration, 250);
  assert.equal(calls[1].searchParams.get('cid'), '2');
  playback = { format: 'mp4', durl: [{ length: 120000, url: 'https://audio.bilivideo.com/preview.mp4' }] };
  await assert.rejects(resolve(), /videoIncomplete/);
  playback.durl[0].length = 250000;
  assert.equal((await resolve()).protocol, 'https');
  playback.durl[0].url = 'http://127.0.0.1/private';
  await assert.rejects(resolve(), /videoUnavailable/);
});

test('Bilibili uses WBI metadata when the legacy view endpoint is blocked', async t => {
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    const { pathname } = new URL(input);
    if (pathname === '/x/web-interface/view') return new Response('', { status: 412 });
    if (pathname === '/x/web-interface/wbi/view') return Response.json({ code: 0, data: { title: '洋葱', pages: [{ cid: 41701411152, duration: 261 }] } });
    assert.equal(pathname, '/x/player/playurl');
    return Response.json({ code: 0, data: { dash: { duration: 261, audio: [{ codecs: 'mp4a.40.2', baseUrl: 'https://audio.bilivideo.com/song.m4s' }] } } });
  });
  const audio = await bilibiliAudio(new URL('https://www.bilibili.com/video/BV1S9YE69ESm'), AbortSignal.timeout(1000));
  assert.equal(audio.title, '洋葱');
  assert.equal(audio.duration, 261);
});

test('Bilibili preserves safe CDN alternatives including its Akamai host', async t => {
  const primary = 'https://audio.bilivideo.com/song.m4s';
  const backup = 'https://upos-hz-mirrorakam.akamaized.net/song.m4s';
  const track = { codecs: 'mp4a.40.2', baseUrl: primary, backupUrl: [backup, 'https://upos-hz-mirrorakam.akamaized.net.evil.test/song.m4s', 'http://127.0.0.1/private', 'https://peer.bilivideo.cn:8082/song.m4s'] };
  t.mock.method(globalThis, 'fetch', async (input: string) => Response.json({ code: 0, data: new URL(input).pathname.endsWith('/view')
    ? { pages: [{ cid: 1, duration: 261 }] }
    : { dash: { duration: 261, audio: [track] } } }));
  const resolve = () => bilibiliAudio(new URL('https://www.bilibili.com/video/BV1S9YE69ESm'), AbortSignal.timeout(1000));
  assert.deepEqual((await resolve()).formats.map(format => format.url), [primary, backup]);
  track.baseUrl = backup;
  track.backupUrl = [];
  assert.equal((await resolve()).url, backup);
  track.baseUrl = 'https://unrelated.akamaized.net/song.m4s';
  await assert.rejects(resolve(), /videoUnavailable/);
});
