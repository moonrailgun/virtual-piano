import assert from 'node:assert/strict';
import { test } from 'node:test';
import { transcribeSong } from '../src/song-transcription.ts';

test('song requests stay below the upload limit and join only boundary copies within each part', async () => {
  const samples = new Float32Array(44100 * 11);
  samples.fill(.5);
  const audio = { sampleRate: 44100, length: samples.length, numberOfChannels: 2, getChannelData: () => samples };
  const original = globalThis.fetch;
  const controller = new AbortController();
  const lengths: number[] = [];
  const progress: number[] = [];
  try {
    globalThis.fetch = async (_url, options) => {
      assert.equal(options?.signal, controller.signal);
      const wav = new DataView(await (options!.body as Blob).arrayBuffer());
      assert.ok(wav.byteLength < 4_500_000);
      assert.equal(wav.getUint16(22, true), 2);
      assert.equal(wav.getUint32(24, true), 44100);
      assert.equal(wav.getInt16(44, true), 16384);
      lengths.push((wav.byteLength - 44) / 4 / 44100);
      const start = lengths.length === 1 ? 4 : 0;
      const end = lengths.length === 1 ? 6 : 2;
      const notes = lengths.length > 2 ? [] : ['melody', 'bass'].map(part => ({ pitch: 60, start, end, velocity: .8, part }));
      return new Response(`${JSON.stringify({ type: 'progress', progress: .5, stage: 'separating' })}\n\n${JSON.stringify({ type: 'complete', notes })}\n`);
    };
    const notes = await transcribeSong(audio, controller.signal, data => progress.push(data.progress));
    assert.deepEqual(lengths, [6, 7, 2]);
    assert.deepEqual(notes.map(({ start, end, part }) => ({ start, end, part })), [
      { start: 4, end: 6, part: 'melody' }, { start: 4, end: 6, part: 'bass' },
    ]);
    assert.ok(progress.every((value, i) => value >= 0 && value <= 1 && (!i || value >= progress[i - 1])));
    globalThis.fetch = async () => new Response('{"type":"progress","progress":0.1}\n');
    await assert.rejects(transcribeSong(audio, controller.signal, () => {}), /songDisconnected/);
    globalThis.fetch = async () => { controller.abort(); return new Response('{"type":"complete","notes":[]}\n'); };
    await assert.rejects(transcribeSong(audio, controller.signal, () => {}), { name: 'AbortError' });
  } finally {
    globalThis.fetch = original;
  }
});
