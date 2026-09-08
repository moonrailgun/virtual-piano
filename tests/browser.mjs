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
evaluate(() => ['language', 'notation', 'tonic'].forEach(key => localStorage.removeItem(`echo-piano-${key}`)));
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
  AudioBufferSourceNode.prototype.start = function (...args) { window.check.strikes++; window.check.lastSource = this; return start.apply(this, args); };
  const url = URL.createObjectURL;
  URL.createObjectURL = function (blob) { if (blob.type === 'audio/midi') window.check.midi = blob; return url.call(this, blob); };
  const click = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function () { if (!this.download) click.call(this); };
});

assert.equal(evaluate(() => document.getElementById('numbered-guide').hidden), true);
click('#score-numbered');
assert.equal(evaluate(() => document.getElementById('numbered-guide').open), false, 'The key map starts collapsed');
const scoreLayout = evaluate(() => [document.getElementById('piano-scroll').offsetTop, document.querySelector('.instrument').offsetHeight]);
click('#numbered-guide summary');
assert.equal(evaluate(() => document.getElementById('numbered-guide').open), true);
assert.deepEqual(evaluate(() => [document.getElementById('piano-scroll').offsetTop, document.querySelector('.instrument').offsetHeight]), scoreLayout, 'Opening the floating map must not move or resize the score');
assert.deepEqual(evaluate(() => [...document.querySelectorAll('.keymap-row')].map(row => [...row.querySelectorAll('[data-shortcut]')].map(key => key.dataset.shortcut).join('')).filter(Boolean)), ['qweruiop', 'asdfjkl;', 'zxcvm,./']);
assert.equal(evaluate(() => document.querySelectorAll('.keymap-key').length), 61, 'Draw the full keyboard main block, including unused keys');
assert.equal(evaluate(() => {
  const keys = [...document.querySelectorAll('.keymap-key')];
  const rect = label => keys.find(key => key.firstElementChild.textContent === label).getBoundingClientRect();
  return rect('Q').x < rect('A').x && rect('A').x < rect('Z').x && rect('⌫').width > rect('Q').width * 1.8 && rect('Space').width > rect('Q').width * 5;
}), true, 'Use staggered letter rows and wide modifier keys');
assert.equal(evaluate(() => {
  const key = document.querySelector('.keymap-key[data-shortcut="q"]').getBoundingClientRect();
  return Math.abs(key.width - key.height) < 1 && [...document.querySelectorAll('.keymap-key')].every(button => Math.abs(button.getBoundingClientRect().height - key.height) < 1);
}), true, 'Standard keys must be square and every row must use the same key height');
assert.equal(evaluate(() => document.querySelector('.keymap-key[data-shortcut="p"] b').dataset.above), '·\n·');
assert.equal(evaluate(() => document.querySelector('.keymap-key[data-shortcut="/"] b').dataset.below), '');
evaluate(() => { const select = document.getElementById('major-key'); select.value = '2'; select.dispatchEvent(new Event('change')); });
assert.deepEqual(evaluate(() => ['a', 'j', 'l', ';'].map(key => document.querySelector(`.keymap-key[data-shortcut="${key}"] small`).textContent)), ['D4', 'A4', 'C♯5', 'D5']);
language('zh');
assert.match(evaluate(() => document.querySelector('#numbered-guide summary').innerText), /收起键位图/);
assert.equal(evaluate(() => document.getElementById('numbered-guide').open), true);
language('en');
// Native keypress delivery requires desktop focus; check that our handler leaves
// the summary's native Space action intact even in a background test tab.
assert.equal(evaluate(() => document.querySelector('#numbered-guide summary').dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))), true, 'Space on the key map must not be captured by playback');
click('#numbered-guide summary');
assert.equal(evaluate(() => document.getElementById('numbered-guide').open), false);
evaluate(() => { const select = document.getElementById('major-key'); select.value = '0'; select.dispatchEvent(new Event('change')); });

// Shift changes only new numbered notes; keyup must release the original pitch.
evaluate(() => {
  window.check.key = (type, key, shiftKey = false) => {
    const punctuation = { ';': ['Semicolon', ':'], ',': ['Comma', '<'], '.': ['Period', '>'], '/': ['Slash', '?'] };
    window.dispatchEvent(new KeyboardEvent(type, { key: shiftKey ? punctuation[key]?.[1] ?? key.toUpperCase() : key, code: punctuation[key]?.[0] ?? `Key${key.toUpperCase()}`, shiftKey }));
  };
  window.check.key('keydown', 'a');
  window.check.key('keydown', 'j');
});
await until(() => window.check.strikes >= 2, 10000);
evaluate(() => window.check.key('keydown', 's', true));
await until(() => window.check.strikes >= 3, 5000);
assert.ok(Math.abs(evaluate(() => window.check.lastSource.playbackRate.value) - 2 ** (3 / 12)) < .0001, 'Shift+S must sound D♯4 in C major');
assert.deepEqual(evaluate(async () => { await new Promise(requestAnimationFrame); return [...document.querySelectorAll('.key.active')].map(key => Number(key.dataset.midi)); }), [60, 63, 67], 'Adding a shifted note must preserve held natural notes');
assert.equal(evaluate(async () => {
  let ended = false;
  window.check.lastSource.addEventListener('ended', () => { ended = true; });
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Shift', code: 'ShiftLeft' }));
  window.check.key('keyup', 's');
  await new Promise(resolve => setTimeout(resolve, 250));
  await new Promise(requestAnimationFrame);
  return ended && !document.querySelector('[data-midi="63"]').classList.contains('active');
}), true, 'Releasing Shift before the note must not leave it sounding');
evaluate(() => { window.check.key('keyup', 'a'); window.check.key('keyup', 'j'); window.check.key('keydown', 'd', true); });
await until(() => window.check.strikes >= 4, 5000);
assert.equal(evaluate(async () => {
  let ended = false;
  window.check.lastSource.addEventListener('ended', () => { ended = true; });
  window.check.key('keydown', 'f'); // Shift+3 and 4 share a pitch.
  window.check.key('keyup', 'd');
  await new Promise(resolve => setTimeout(resolve, 250));
  await new Promise(requestAnimationFrame);
  const sustained = !ended && document.querySelector('[data-midi="65"]').classList.contains('active');
  window.check.key('keyup', 'f', true);
  await new Promise(resolve => setTimeout(resolve, 250));
  return sustained && ended;
}), true, 'A shared pitch must sustain until both physical keys are released');
evaluate(() => { window.check.key('keydown', 'q', true); window.check.key('keydown', 'z', true); });
await until(() => window.check.strikes >= 6, 5000);
assert.deepEqual(evaluate(async () => { await new Promise(requestAnimationFrame); return [...document.querySelectorAll('.key.active')].map(key => Number(key.dataset.midi)); }), [49, 73]);
evaluate(() => window.dispatchEvent(new Event('blur')));
assert.equal(evaluate(async () => { await new Promise(requestAnimationFrame); return document.querySelectorAll('.key.active').length; }), 0);
assert.equal(evaluate(async () => {
  window.check.key('keydown', 'a');
  await new Promise(resolve => setTimeout(resolve, 100));
  let ended = false;
  window.check.lastSource.addEventListener('ended', () => { ended = true; });
  window.check.key('keydown', '/');
  window.check.key('keyup', 'a');
  await new Promise(resolve => setTimeout(resolve, 250));
  await new Promise(requestAnimationFrame);
  const sustained = !ended && document.querySelector('[data-midi="60"]').classList.contains('active');
  window.check.key('keyup', '/');
  await new Promise(resolve => setTimeout(resolve, 250));
  return sustained && ended;
}), true, 'The low-row final tonic must sustain the same note as middle A');
evaluate(() => [';', ',', '.', '/'].forEach(key => window.check.key('keydown', key, true)));
await until(() => document.querySelectorAll('.key.active').length === 4, 5000);
assert.deepEqual(evaluate(() => [...document.querySelectorAll('.key.active')].map(key => Number(key.dataset.midi))), [58, 60, 61, 73], 'Shift must work with the physical punctuation keys');
evaluate(() => [';', ',', '.', '/'].forEach(key => window.check.key('keyup', key)));
assert.equal(evaluate(async () => { await new Promise(requestAnimationFrame); return document.querySelectorAll('.key.active').length; }), 0);
click('#score-piano');
const pianoStrikes = evaluate(() => { const before = window.check.strikes; window.check.key('keydown', 'a', true); return before; });
await until(() => document.querySelector('[data-midi="60"]').classList.contains('active'), 5000);
assert.ok(evaluate(() => window.check.strikes) > pianoStrikes);
assert.equal(evaluate(() => window.check.lastSource.playbackRate.value), 1, 'Shift must preserve piano-mode shortcuts');
evaluate(() => window.check.key('keyup', 'a'));
console.log('Key map and keyboard: native disclosure, translations, tuning, two-hand layout, Shift audio, punctuation, shared notes and releases passed');
if (process.argv.includes('--keyboard-only')) process.exit(0);

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

// Numbered shortcuts must move to the actual pitches, including black keys.
click('#score-numbered');
assert.deepEqual(evaluate(() => {
  const shortcut = key => Number([...document.querySelectorAll('.key')].find(button => button.querySelector('.key-shortcut').textContent.split(' ').includes(key)).dataset.midi);
  return ['A', 'S', 'Q', 'Z'].map(shortcut);
}), [60, 62, 72, 48]);
assert.equal(evaluate(() => document.querySelector('[data-midi="72"] .key-label').dataset.above), '·');
assert.equal(evaluate(() => document.querySelector('[data-midi="48"] .key-label').dataset.below), '·');
assert.equal(evaluate(() => document.querySelector('[data-midi="61"] .key-label').textContent), '♯1');
evaluate(() => {
  const select = document.getElementById('major-key'); select.value = '2'; select.dispatchEvent(new Event('change'));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }));
});
await until(() => window.check.lastSource.playbackRate.value > 1.1 && document.querySelector('[data-midi="62"]').classList.contains('active'), 5000);
assert.ok(Math.abs(evaluate(() => window.check.lastSource.playbackRate.value) - 2 ** (2 / 12)) < .0001, 'A must sound D4 in D major');
assert.equal(evaluate(() => document.querySelector('[data-midi="66"] .key-shortcut').textContent), 'D');
assert.equal(evaluate(() => document.querySelector('[data-midi="73"] .key-label').dataset.above), '', 'D-major degree 7 stays in the middle octave');
assert.equal(evaluate(async () => {
  let ended = false;
  window.check.lastSource.addEventListener('ended', () => { ended = true; });
  const select = document.getElementById('major-key'); select.value = '11'; select.dispatchEvent(new Event('change'));
  const strikes = window.check.strikes;
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA', repeat: true }));
  await new Promise(resolve => setTimeout(resolve, 250));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'A', code: 'KeyA' }));
  await new Promise(requestAnimationFrame);
  return ended && window.check.strikes === strikes && !document.querySelector('[data-midi="62"]').classList.contains('active') && !document.querySelector('[data-midi="71"]').classList.contains('active');
}), true, 'Changing key must stop held notes and ignore repeats until keyup');
assert.equal(evaluate(() => document.querySelector('[data-midi="73"] .key-label').dataset.above), '', 'B-major degree 2 stays in the middle octave');
assert.equal(evaluate(async () => {
  const input = document.getElementById('major-key'); input.focus();
  const before = window.check.strikes;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'q', code: 'KeyQ', bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 50));
  return window.check.strikes === before;
}), true, 'Typing in a select must not play notes');
language('zh');
assert.equal(evaluate(() => document.getElementById('score-numbered').textContent), '简谱');
assert.match(evaluate(() => document.querySelector('[data-midi="71"]').getAttribute('aria-label')), /简谱 1/);
language('en');
evaluate(() => { window.check.midi = null; });
click('#export');
await until(() => !!window.check.midi);
assert.deepEqual(evaluate(async () => Array.from(new Uint8Array(await window.check.midi.arrayBuffer()))), bytes, 'Notation changes must preserve exported absolute pitches and timing');
click('#piano-mode');
click('#play');
await until(() => Number(document.getElementById('seek').value) > .5, 5000);
const notationPosition = evaluate(() => Number(document.getElementById('seek').value));
click('#score-piano');
assert.equal(evaluate(() => document.getElementById('play').getAttribute('aria-label')), 'Pause');
assert.ok(evaluate(() => Number(document.getElementById('seek').value)) >= notationPosition);
assert.equal(evaluate(() => document.querySelector('[data-midi="61"] .key-shortcut').textContent), 'W');
click('#play');
console.log('Numbered mode: octave dots, accidentals, transposed sound, held-note release, focus guards, translations and unchanged MIDI/playback passed');

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

// Link imports share demo download cancellation and the real audio decoder/worker.
evaluate(() => {
  document.getElementById('video-url').value = 'https://www.bilibili.com/video/BV1geYJ6xE5E';
  const fetch = window.fetch;
  window.fetch = () => { window.fetch = fetch; return Promise.resolve(Response.json({ error: 'videoIncomplete' }, { status: 422 })); };
});
click('#video-import');
await until(complete);
assert.match(evaluate(status), /incomplete audio/);
language('zh');
assert.match(evaluate(status), /音频不完整/);
language('en');
evaluate(() => {
  const fetch = window.fetch;
  window.fetch = () => new Promise(resolve => { window.check.releaseLink = () => { window.fetch = fetch; resolve(new Response('stale audio')); }; });
});
click('#video-import');
assert.equal(evaluate(() => document.getElementById('video-import').disabled), true);
click('#cancel');
evaluate(() => window.check.releaseLink());
await sleep(300);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'silence');
assert.match(evaluate(status), /Transcription cancelled/);
evaluate(async () => {
  window.check.linkAudio = await (await fetch('demo.mp3')).blob();
  const fetchOriginal = window.fetch;
  window.fetch = () => { window.fetch = fetchOriginal; return Promise.resolve(new Response(window.check.linkAudio, { headers: { 'X-Audio-Title': encodeURIComponent('Video test') } })); };
});
click('#video-import');
await until(complete);
assert.match(evaluate(status), /Transcription complete/);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'Video test');
assert.equal(evaluate(() => document.getElementById('export').disabled), false);
evaluate(() => {
  const fetch = window.fetch;
  window.fetch = () => { window.fetch = fetch; return Promise.resolve(new Response(window.check.linkAudio, { headers: { 'X-Audio-Duration': '999', 'X-Audio-Title': 'Incomplete' } })); };
});
click('#video-import');
await until(complete);
assert.match(evaluate(status), /incomplete audio/);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'Video test');
assert.equal(evaluate(() => document.getElementById('video-import').disabled), false);
console.log('Video: translated errors, cancellation, audio import and incomplete decode rejection passed');

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

click('#score-numbered');
evaluate(() => { const select = document.getElementById('major-key'); select.value = '11'; select.dispatchEvent(new Event('change')); });
orca('reload');
await until(() => !!document.getElementById('major-key'), 10000);
assert.equal(evaluate(() => document.getElementById('score-numbered').getAttribute('aria-pressed')), 'true');
assert.equal(evaluate(() => document.getElementById('major-key').value), '11');
assert.equal(evaluate(() => document.querySelector('[data-midi="71"] .key-shortcut').textContent), 'A /');
assert.ok(evaluate(() => {
  const key = document.querySelector('[data-midi="71"]').getBoundingClientRect();
  const scroll = document.getElementById('piano-scroll').getBoundingClientRect();
  return key.left >= scroll.left && key.right <= scroll.right;
}), 'The restored middle tonic must be visible');
evaluate(() => { localStorage.setItem('echo-piano-notation', 'invalid'); localStorage.setItem('echo-piano-tonic', '99'); });
orca('reload');
await until(() => !!document.getElementById('major-key'), 10000);
assert.equal(evaluate(() => document.getElementById('score-piano').getAttribute('aria-pressed')), 'true');
assert.equal(evaluate(() => document.getElementById('major-key').value), '0');
console.log('Preferences: language and notation persistence, invalid fallback, restored tonic visibility passed');

// A fresh page must import without a click, preserving the source URL's own query.
const audioUrl = evaluate(() => {
  const source = new URL('demo.mp3', location.href);
  source.search = new URLSearchParams({ source: 'auto', token: 'a&b' });
  history.replaceState(null, '', `?${new URLSearchParams({ importUrl: source.href })}`);
  return source.href;
});
orca('reload');
await until(() => !!document.getElementById('processing'), 10000);
await until(complete);
assert.match(evaluate(status), /Transcription complete/);
assert.equal(evaluate(() => document.getElementById('song-name').textContent), 'demo');
assert.equal(evaluate(() => document.getElementById('video-url').value), audioUrl);
assert.equal(evaluate(() => document.getElementById('play').getAttribute('aria-label')), 'Play');
assert.equal(evaluate(() => document.getElementById('export').disabled), false);
evaluate(() => history.replaceState(null, '', '?importUrl=javascript%3Aalert(1)'));
orca('reload');
await until(() => !!document.getElementById('processing'), 10000);
await until(complete);
assert.match(evaluate(status), /HTTP or HTTPS/);
assert.equal(evaluate(() => document.getElementById('video-import').disabled), false);
evaluate(() => history.replaceState(null, '', location.pathname));
console.log('Auto import: fresh-page audio, nested URL parameters, no autoplay and invalid URL recovery passed');
