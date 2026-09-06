// npm run test:song -- <Orca page ID> <local song path>; processes the actual file locally.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import midiPackage from '@tonejs/midi';

const [page, path] = process.argv.slice(2);
assert.ok(page && path, 'Pass an Orca page ID and a local song path');
function orca(...args) {
  const result = JSON.parse(execFileSync('orca', [...args, '--page', page, '--json'], { encoding: 'utf8', maxBuffer: 5e6 }));
  assert.ok(result.ok, JSON.stringify(result.error));
  return result.result;
}
function evaluate(fn, ...args) {
  return JSON.parse(orca('eval', '--expression', `(async()=>JSON.stringify((await (${fn})(...${JSON.stringify(args)})) ?? null))()`).result);
}
function click(selector) {
  evaluate(selector => document.querySelector(selector).scrollIntoView({ block: 'center' }), selector);
  orca('click', '--element', selector);
}
async function until(fn, timeout = 600000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (evaluate(fn)) return; await sleep(500); }
  throw new Error(`Timed out: ${fn}`);
}
evaluate(() => localStorage.removeItem('echo-piano-language'));
orca('reload');
await until(() => document.getElementById('model-status').dataset.i18n === 'modelReady', 10000);
evaluate(() => {
  window.check = {};
  const create = AudioContext.prototype.createDynamicsCompressor;
  AudioContext.prototype.createDynamicsCompressor = function () {
    const compressor = create.call(this);
    window.check.analyser = this.createAnalyser();
    compressor.connect(window.check.analyser);
    return compressor;
  };
  const url = URL.createObjectURL;
  URL.createObjectURL = function (blob) { if (blob.type === 'audio/midi') window.check.midi = blob; return url.call(this, blob); };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
});
orca('upload', '--element', '#file', '--files', path);
await until(() => Number(document.getElementById('progress').value) > 0, 30000);
click('#cancel');
assert.match(evaluate(() => document.getElementById('message').textContent), /Transcription cancelled/);
await sleep(2000);
const processes = execFileSync('ps', ['-axo', 'command'], { encoding: 'utf8' });
assert.ok(!processes.split('\n').some(line => /python.*server\/transcribe\.py/.test(line)), 'Cancel must stop the model process');
console.log('Song cancellation: UI recovered and model process exited');

const started = Date.now();
orca('upload', '--element', '#file', '--files', path);
await until(() => document.getElementById('processing').hidden);
assert.match(evaluate(() => document.getElementById('message').textContent), /Melody and bass extracted/);
click('#export');
await until(() => !!window.check.midi, 10000);
const bytes = evaluate(async () => Array.from(new Uint8Array(await window.check.midi.arrayBuffer())));
const midi = new midiPackage.Midi(bytes);
assert.equal(midi.tracks.length, 2);
assert.deepEqual(new Set(midi.tracks.map(track => track.name)), new Set(['Melody', 'Bass']));
for (const track of midi.tracks) {
  assert.ok(track.notes.length > 0);
  assert.ok(track.notes.every(note => note.duration > 0 && note.midi >= 21 && note.midi <= 108));
  assert.ok(track.notes.every((note, i) => !i || note.time >= track.notes[i - 1].time + track.notes[i - 1].duration - .01), 'Each extracted part is monophonic');
}
const melody = midi.tracks.find(track => track.name === 'Melody');
const time = melody.notes.find(note => note.time > 30 && note.duration > .2)?.time ?? melody.notes[0].time;
evaluate(time => { const seek = document.getElementById('seek'); seek.value = String(time); seek.dispatchEvent(new Event('input')); }, time);
click('#play');
await until(() => {
  const data = new Float32Array(window.check.analyser.fftSize);
  window.check.analyser.getFloatTimeDomainData(data);
  return data.some(value => Math.abs(value) > .0001) && document.querySelectorAll('.key.active').length;
}, 10000);
click('#play');
writeFileSync('/tmp/echo-song-verified.mid', Buffer.from(bytes));
console.log(`Song → MIDI: ${midi.tracks.map(track => `${track.name} ${track.notes.length}`).join(', ')}; ${((Date.now() - started) / 1000).toFixed(1)}s; piano signal and active keys passed`);
