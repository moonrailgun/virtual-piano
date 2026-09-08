import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keyboardMapping, mergeNotes, numberedNote, pianoKeys, noteName, visibleNotes } from '../src/music.ts';

test('numbered shortcuts transpose all three octaves and preserve piano shortcuts', () => {
  const c = keyboardMapping('numbered', 0);
  assert.deepEqual('asdfjkl;'.split('').map(key => c[key]), [60, 62, 64, 65, 67, 69, 71, 72]);
  assert.deepEqual('qweruiop'.split('').map(key => c[key]), [72, 74, 76, 77, 79, 81, 83, 84]);
  assert.deepEqual('zxcvm,./'.split('').map(key => c[key]), [48, 50, 52, 53, 55, 57, 59, 60]);
  const d = keyboardMapping('numbered', 2);
  assert.deepEqual([d.a, d.d, d.l, d.q, d.z], [62, 66, 73, 74, 50]);
  for (let tonic = 0; tonic < 12; tonic++) {
    const mapping = keyboardMapping('numbered', tonic);
    assert.equal(Object.keys(mapping).length, 24);
    assert.equal(new Set(Object.values(mapping)).size, 22);
    assert.equal(mapping['/'], mapping.a);
    assert.equal(mapping[';'], mapping.q);
    for (const key of Object.keys(c)) assert.equal(mapping[key], c[key] + tonic);
  }
  assert.deepEqual(keyboardMapping('piano', 11), keyboardMapping('piano', 0));
  assert.equal(keyboardMapping('piano', 0).w, 61);
});

test('numbered labels retain accidentals and count octaves relative to the tonic', () => {
  for (const [pitch, tonic, degree, octave] of [
    [48, 0, '1', -1], [60, 0, '1', 0], [72, 0, '1', 1],
    [61, 0, '♯1', 0], [66, 2, '3', 0], [73, 2, '7', 0],
    [60, 2, '♯6', -1], [71, 11, '1', 0], [73, 11, '2', 0],
    [83, 11, '1', 1], [21, 0, '6', -4], [108, 0, '1', 4],
  ] as const) assert.deepEqual(numberedNote(pitch, tonic), { degree, octave });
});

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
