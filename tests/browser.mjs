// Run against an Orca browser tab serving this app: npm run test:browser -- <page-id>
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import midiPackage from '@tonejs/midi';

const page = process.argv[2];
assert.ok(page, 'Pass the Orca browser page ID');
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
async function until(fn, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (evaluate(fn)) return; await sleep(300); }
  throw new Error(`Timed out: ${fn}`);
}
const complete = () => document.getElementById('processing').hidden;
const status = () => document.getElementById('message').textContent;
function language(value) {
  evaluate(value => { const select = document.getElementById('language'); select.value = value; select.dispatchEvent(new Event('change')); }, value);
}
evaluate(() => localStorage.removeItem('echo-piano-language'));
orca('reload');
await until(() => !!document.getElementById('language'), 10000);
assert.equal(evaluate(() => document.documentElement.lang), 'en');
assert.equal(evaluate(() => document.title), 'Echo Piano');
assert.equal(evaluate(() => document.getElementById('play').getAttribute('aria-label')), 'Play');
assert.doesNotMatch(evaluate(() => document.body.innerText.replaceAll('中文', '')), /\p{Script=Han}/u);
language('zh');
assert.equal(evaluate(() => document.documentElement.lang), 'zh-CN');
assert.equal(evaluate(() => document.getElementById('play').getAttribute('aria-label')), '播放');
orca('reload');
await until(() => !!document.getElementById('language'), 10000);
assert.equal(evaluate(() => document.getElementById('language').value), 'zh');
assert.equal(evaluate(() => document.documentElement.lang), 'zh-CN');
evaluate(() => localStorage.setItem('echo-piano-language', 'unsupported'));
orca('reload');
await until(() => !!document.getElementById('language'), 10000);
assert.equal(evaluate(() => document.documentElement.lang), 'en');
evaluate(() => { document.getElementById('transcription-mode').value = 'instrument'; });
evaluate(() => {
  window.check = { strikes: 0 };
  const create = AudioContext.prototype.createDynamicsCompressor;
  AudioContext.prototype.createDynamicsCompressor = function () {
    const compressor = create.call(this);
    window.check.analyser = this.createAnalyser();
    compressor.connect(window.check.analyser);
    return compressor;
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) { window.check.strikes++; return start.apply(this, args); };
  const url = URL.createObjectURL;
  URL.createObjectURL = function (blob) { if (blob.type === 'audio/midi') window.check.midi = blob; return url.call(this, blob); };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
});

// The file picker path must reject corrupt input and recover for the next upload.
evaluate(() => {
  const transfer = new DataTransfer();
  transfer.items.add(new File(['not an mp3'], 'broken.mp3', { type: 'audio/mpeg' }));
  const input = document.getElementById('file');
  input.files = transfer.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
});
await until(complete);
assert.match(evaluate(status), /Unable to decode/);
language('zh');
assert.match(evaluate(status), /无法解码/);
language('en');
assert.match(evaluate(status), /Unable to decode/);
click('#demo');
await until(() => !document.getElementById('processing').hidden);
language('zh');
assert.match(evaluate(() => document.getElementById('process-label').textContent), /正在/);
click('#cancel');
assert.match(evaluate(status), /已取消/);
language('en');
assert.match(evaluate(status), /Transcription cancelled/);

const started = Date.now();
assert.equal(evaluate(async () => {
  const transfer = new DataTransfer();
  transfer.items.add(new File([await (await fetch('./demo.mp3')).blob()], 'drag-test.mp3', { type: 'audio/mpeg' }));
  window.dispatchEvent(new DragEvent('dragenter', { dataTransfer: transfer, bubbles: true }));
  const overlay = !document.getElementById('drop-overlay').hidden;
  window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, bubbles: true, cancelable: true }));
  return overlay && document.getElementById('drop-overlay').hidden;
}), true);
await until(complete);
assert.match(evaluate(status), /Transcription complete/);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'drag-test');
click('#export');
await until(() => !!window.check.midi);
const bytes = evaluate(async () => Array.from(new Uint8Array(await window.check.midi.arrayBuffer())));
const notes = new midiPackage.Midi(bytes).tracks[0].notes;
const expected = JSON.parse(readFileSync(new URL('./demo-notes.json', import.meta.url)));
const matched = new Set();
const hits = expected.filter(e => {
  const i = notes.findIndex((n, i) => !matched.has(i) && n.midi === e.pitch && Math.abs(n.time - e.start) < .2);
  if (i < 0) return false;
  matched.add(i); return true;
}).length;
const recall = hits / expected.length;
const pitchCoverage = notes.filter(n => expected.some(e => n.midi === e.pitch && n.time >= e.start - .2 && n.time < e.end + .2)).length / notes.length;
assert.ok(recall >= .9, `Onset/pitch recall ${recall}`);
assert.ok(pitchCoverage >= .8, `Pitch coverage ${pitchCoverage}`);
assert.ok(notes.some(n => n.time > 20), 'Second inference chunk missing');
console.log(`MP3 → MIDI: ${notes.length} notes; ${hits}/${expected.length} reference onsets; ${(pitchCoverage * 100).toFixed(1)}% pitch coverage; ${((Date.now() - started) / 1000).toFixed(1)}s`);

click('#piano-mode');
click('#play');
await until(() => Number(document.getElementById('seek').value) > .7, 10000);
assert.ok(evaluate(() => {
  const samples = new Float32Array(window.check.analyser.fftSize);
  window.check.analyser.getFloatTimeDomainData(samples);
  return samples.some(sample => Math.abs(sample) > .0001) && document.querySelectorAll('.key.active').length > 0;
}), 'Piano must produce a nonzero audio signal and highlight keys');
const beforeSwitch = evaluate(() => Number(document.getElementById('seek').value));
language('zh');
assert.equal(evaluate(() => document.getElementById('play').getAttribute('aria-label')), '暂停');
assert.match(evaluate(() => document.getElementById('instrument-status').textContent), /钢琴演奏中/);
assert.match(evaluate(() => document.getElementById('note-count').textContent), /个音符/);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'drag-test');
language('en');
assert.equal(evaluate(() => document.getElementById('play').getAttribute('aria-label')), 'Pause');
assert.ok(evaluate(() => Number(document.getElementById('seek').value)) >= beforeSwitch);
assert.match(evaluate(status), /Transcription complete/);
click('#play');
const paused = evaluate(async () => {
  await new Promise(requestAnimationFrame); // The seek display updates on the next frame after pausing.
  return Number(document.getElementById('seek').value);
});
await sleep(350);
assert.equal(evaluate(() => Number(document.getElementById('seek').value)), paused);
evaluate(() => { const seek = document.getElementById('seek'); seek.value = '18.5'; seek.dispatchEvent(new Event('input')); });
assert.equal(evaluate(() => Number(document.getElementById('seek').value)), 18.5);
click('#original-mode');
evaluate(() => { const speed = document.getElementById('speed'); speed.value = '1.5'; speed.dispatchEvent(new Event('change')); });
click('#play');
await until(() => Number(document.getElementById('seek').value) > 19, 5000);
click('#play');
click('#restart');
await until(() => Number(document.getElementById('seek').value) === 0, 5000);
const strikes = evaluate(() => {
  const button = document.getElementById('piano-mode');
  button.focus();
  const strikes = window.check.strikes;
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', bubbles: true }));
  return strikes;
});
await until(() => document.querySelector('[data-midi="60"]').classList.contains('active'), 5000);
assert.ok(evaluate(() => window.check.strikes) > strikes, 'Keyboard shortcuts must work with a toolbar button focused');
evaluate(() => window.dispatchEvent(new KeyboardEvent('keyup', { key: 'a', code: 'KeyA', bubbles: true })));
console.log('Playback: audible piano signal, active keys, pause, seek, speed, original audio, restart, manual keys passed');

// Silence must remain silence, including after replacing a valid score.
evaluate(() => {
  const bytes = new ArrayBuffer(44 + 22050 * 2);
  const view = new DataView(bytes);
  const text = (offset, value) => [...value].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, bytes.byteLength - 8, true); text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 22050, true); view.setUint32(28, 44100, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, bytes.byteLength - 44, true);
  const transfer = new DataTransfer(); transfer.items.add(new File([bytes], 'silence.wav', { type: 'audio/wav' }));
  window.dispatchEvent(new DragEvent('drop', { dataTransfer: transfer, cancelable: true }));
});
await until(complete);
assert.match(evaluate(status), /No clear notes detected/);
assert.equal(evaluate(() => document.getElementById('export').disabled), true);
console.log('Recovery: invalid file, cancellation, replacement, silence passed');

// Failed/empty downloads must restore controls so another demo can be loaded.
for (const status of [503, 200]) {
  evaluate(status => {
    const fetch = window.fetch;
    window.fetch = (...args) => {
      window.fetch = fetch;
      return Promise.resolve(new Response('', { status }));
    };
  }, status);
  click('#demo');
  await until(complete);
  assert.match(evaluate(() => document.getElementById('message').textContent), /Unable to load the demo/);
  assert.equal(evaluate(() => document.getElementById('demo').disabled), false);
}

// A cancelled demo download must not replace the score when its response arrives late.
assert.equal(evaluate(() => document.querySelectorAll('#demo-song option').length), 3);
evaluate(() => {
  document.getElementById('demo-song').value = 'demos/moonlight.mp3';
  const fetch = window.fetch;
  window.fetch = (...args) => String(args[0]).endsWith('demos/moonlight.mp3')
    ? new Promise(resolve => { window.check.releaseDemo = () => { window.fetch = fetch; resolve(new Response('stale audio')); }; })
    : fetch(...args);
});
click('#demo');
assert.equal(evaluate(() => document.getElementById('process-label').textContent), 'Loading the demo audio…');
click('#cancel');
evaluate(() => window.check.releaseDemo());
await sleep(400);
assert.match(evaluate(status), /Transcription cancelled/);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'silence');
assert.equal(evaluate(() => document.getElementById('demo').disabled), false);

for (const demo of [
  { url: 'demos/moonlight.mp3', en: 'Moonlight Sonata · I · Beethoven', zh: '月光奏鸣曲 · 第一乐章 · 贝多芬', duration: 306.67, finalBars: 290 },
  { url: 'demos/fur-elise.mp3', en: 'Für Elise · Beethoven', zh: '致爱丽丝 · 贝多芬', duration: 176.59, finalBars: 165 },
]) {
  const demoStarted = Date.now();
  evaluate(url => { document.getElementById('demo-song').value = url; }, demo.url);
  click('#demo');
  await until(complete, 180000);
  assert.match(evaluate(status), /Transcription complete/);
  assert.equal(evaluate(() => document.getElementById('song-name').textContent), demo.en);
  assert.ok(Math.abs(evaluate(() => Number(document.getElementById('seek').max)) - demo.duration) < 1);
  language('zh');
  assert.equal(evaluate(() => document.getElementById('song-name').textContent), demo.zh);
  assert.equal(evaluate(() => document.getElementById('demo-song').selectedOptions[0].textContent), demo.zh);
  language('en');
  evaluate(() => { window.check.midi = null; });
  click('#export');
  await until(() => !!window.check.midi);
  const midi = new midiPackage.Midi(evaluate(async () => Array.from(new Uint8Array(await window.check.midi.arrayBuffer()))));
  assert.ok(midi.tracks[0].notes.length > 100);
  assert.ok(midi.tracks[0].notes.some(note => note.time > demo.finalBars), `${demo.en} must transcribe through the final bars`);
  evaluate(() => { document.getElementById('speed').value = '1'; });
  click('#play');
  await until(() => {
    const samples = new Float32Array(window.check.analyser.fftSize);
    window.check.analyser.getFloatTimeDomainData(samples);
    return samples.some(sample => Math.abs(sample) > .0001) && document.querySelectorAll('.key.active').length > 0;
  }, 10000);
  click('#play');
  click('#restart');
  console.log(`Demo ${demo.en}: full transcription, translated title, MIDI export and audible playback passed in ${((Date.now() - demoStarted) / 1000).toFixed(1)}s`);
}

console.log('Languages: English default, persisted Chinese, invalid preference fallback, live progress/error/playback translation passed');
