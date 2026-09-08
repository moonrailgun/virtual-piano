import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchAudioLink, readLinkedAudio } from '../src/remote-audio.ts';

test('audio links load directly, video and blocked audio use the API, cancellation never retries', async t => {
  const calls: string[] = [];
  const audio = new Response('audio', { headers: { 'Content-Type': 'audio/mpeg' } });
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(String(url));
    assert.ok(options.signal);
    return audio;
  });
  const signal = new AbortController().signal;
  const source = 'https://example.com/track.MP3?token=a%26b';
  assert.equal(await fetchAudioLink(source, signal), audio);
  assert.deepEqual(calls, [source]);
  calls.length = 0;
  const video = 'https://www.bilibili.com/video/BV1GJ411x7h7?p=2&test=1';
  await fetchAudioLink(video, signal);
  assert.equal(new URL(calls[0], 'https://piano.test').searchParams.get('url'), video);
  assert.ok(calls[0].startsWith('/api/video?'));
  calls.length = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    return String(url).startsWith('/api/') ? audio : new Response('partial', { status: 206, headers: { 'Content-Type': 'audio/mpeg' } });
  });
  await fetchAudioLink(source, signal);
  assert.equal(calls.length, 2);
  calls.length = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    if (!String(url).startsWith('/api/')) throw new TypeError('CORS');
    return audio;
  });
  await fetchAudioLink(source, signal);
  assert.equal(calls.length, 2);
  calls.length = 0;
  const controller = new AbortController();
  t.mock.method(globalThis, 'fetch', async url => {
    calls.push(String(url));
    controller.abort();
    throw controller.signal.reason;
  });
  await assert.rejects(fetchAudioLink(source, controller.signal), { name: 'AbortError' });
  assert.equal(calls.length, 1);
  calls.length = 0;
  for (const url of ['bad', 'javascript:alert(1)', 'file:///etc/passwd', 'https://user:pass@example.com/song.mp3']) {
    await assert.rejects(fetchAudioLink(url, signal), /videoInvalid/);
  }
  assert.equal(calls.length, 0);
  const blob = await readLinkedAudio(audio);
  assert.equal(await blob.text(), 'audio');
  assert.equal(blob.type, 'audio/mpeg');
  await assert.rejects(readLinkedAudio(new Response('x', { headers: { 'Content-Length': String(101 * 1024 * 1024) } })), /videoTooLarge/);
  const chunk = new Uint8Array(1024 * 1024);
  let cancelled = false;
  await assert.rejects(readLinkedAudio(new Response(new ReadableStream({
    pull(controller) { controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  }))), /videoTooLarge/);
  assert.equal(cancelled, true);
});
