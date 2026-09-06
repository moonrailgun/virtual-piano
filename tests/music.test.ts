import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeNotes, pianoKeys, noteName, visibleNotes } from '../src/music.ts';

test('88-key geometry, overlapping chunk notes, and seek visibility', () => {
  const keys = pianoKeys();
  assert.equal(keys.length, 88);
  assert.equal(keys.filter(k => !k.black).length, 52);
  assert.equal(noteName(60), 'C4');
  assert.equal(keys[0].midi, 21);
  assert.equal(keys.at(-1)?.midi, 108);
  const merged = mergeNotes([
    { pitch: 60, start: 0, end: 1, velocity: .8 },
    { pitch: 64, start: .2, end: .8, velocity: .7 },
    { pitch: 60, start: .95, end: 1.5, velocity: .6 },
    { pitch: 60, start: 1.8, end: 2, velocity: .8 },
    { pitch: 10, start: 0, end: 1, velocity: .5 },
  ]);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].end, 1.5);
  assert.deepEqual(visibleNotes(merged, 1.2, 3).map(n => n.pitch), [60, 60]);
});
