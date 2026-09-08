import './style.css';
import { applyTranslations, errorReason, isMessageKey, locale, setLabel, setLocale, setRawText, setText, t, type MessageKey, type Params } from './i18n';
import { PianoAudio, decodeAudio } from './audio';
import { fetchAudioLink, readLinkedAudio } from './remote-audio';
import { formatTime, keyboardMapping, numberedNote, numberedRows, noteName, pianoKeys, visibleNotes, type Note } from './music';

const icons = {
  play: '<path d="m9 5 11 7-11 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14" stroke-width="4"/>',
  upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v5h16v-5"/>',
  download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>',
  rewind: '<path d="M5 5v14m14-14L8 12l11 7z"/>',
  sound: '<path d="m11 4-5 4H2v8h4l5 4zm4 4a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  music: '<path d="M9 18V5l12-2v13M9 8l12-2"/><ellipse cx="5.5" cy="18" rx="3.5" ry="2.5"/><ellipse cx="17.5" cy="16" rx="3.5" ry="2.5"/>',
};
function icon(name: keyof typeof icons) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`; }

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <header class="site-header">
    <a class="brand" href="./" data-i18n-label="home"><span class="brand-mark"><i></i><i></i><i></i><i></i></span><b>Echo Piano</b></a>
    <div class="header-controls"><span class="local-badge"><i></i><span data-i18n="localBadge"></span></span><select id="language" data-i18n-label="language"><option value="en">English</option><option value="zh">中文</option></select></div>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow" data-i18n="eyebrow"></p><h1><span data-i18n="heroLead"></span><em data-i18n="heroEmphasis"></em></h1></div>
      <p class="intro-copy"><span data-i18n="introFirst"></span><br><span data-i18n="introSecond"></span></p>
    </section>
    <section class="import-panel" id="drop-zone" data-i18n-label="importRegion">
      <button class="upload-target" id="choose"><span class="upload-icon">${icon('upload')}</span><span><strong><span data-i18n="dropMusic"></span><span class="choose-hint" data-i18n="chooseHint"></span></strong><small data-i18n="formats"></small></span></button>
      <div class="demo-wrap"><label for="demo-song" data-i18n="demoPrompt"></label><div class="demo-controls"><select id="demo-song"><option value="demo.mp3" data-i18n="demoRain"></option><option value="demos/moonlight.mp3" data-i18n="demoMoonlight"></option><option value="demos/fur-elise.mp3" data-i18n="demoFurElise"></option></select><button class="text-button" id="demo"><span data-i18n="demo"></span><span class="demo-arrow" aria-hidden="true">↗</span></button></div></div>
      <input id="file" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac" hidden>
      <form id="video-form" class="video-form"><label for="video-url" data-i18n="videoLabel"></label><div class="video-controls"><input id="video-url" type="url" required placeholder="https://www.youtube.com/watch?v=…" aria-describedby="video-hint"><button id="video-import" class="outline-button" type="submit" data-i18n="videoImport"></button></div><small id="video-hint" data-i18n="videoHint"></small></form>
    </section>
    <div class="transcription-options"><label for="transcription-mode" data-i18n="audioType"></label><select id="transcription-mode"><option value="song" data-i18n="songMode"></option><option value="instrument" data-i18n="instrumentMode"></option></select><span id="model-status" data-i18n="modelConnecting"></span></div>
    <section id="processing" class="processing" hidden>
      <span class="spinner"></span><div><strong id="process-label" data-i18n="readingAudio"></strong><progress id="progress" max="1" value="0" data-i18n-label="progress"></progress></div><span id="percent">0%</span><button id="cancel" class="text-button" data-i18n="cancel"></button>
    </section>
    <p id="message" class="message" role="status" aria-live="polite"></p>
    <section class="instrument" data-i18n-label="instrumentRegion">
      <div class="score-header">
        <div class="song-info"><span class="record-icon">${icon('music')}</span><div><p class="eyebrow" data-i18n="scoreEyebrow"></p><h2 id="song-name" data-i18n="emptySong"></h2></div></div>
        <div class="score-actions"><span class="note-count" id="note-count" data-i18n="emptyCount"></span><button id="export" class="outline-button" disabled>${icon('download')}<span data-i18n="export"></span></button></div>
      </div>
      <div class="notation-toolbar">
        <span data-i18n="notationMode"></span>
        <div class="listen-mode notation-mode" role="group" data-i18n-label="notationMode"><button id="score-piano" data-i18n="pianoNotation" aria-pressed="true"></button><button id="score-numbered" data-i18n="numberedNotation" aria-pressed="false"></button></div>
        <label id="key-control" hidden><span>1 =</span><select id="major-key" data-i18n-label="majorKey">${['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'].map((key, value) => `<option value="${value}" data-i18n="majorOption" data-i18n-params='${JSON.stringify({ key })}'></option>`).join('')}</select></label>
      </div>
      <details class="numbered-guide" id="numbered-guide" hidden>
        <summary class="outline-button"><span class="guide-show" data-i18n="showKeymap"></span><span class="guide-hide" data-i18n="hideKeymap"></span><span class="guide-chevron" aria-hidden="true">⌄</span></summary>
        <div class="keymap-panel"><div class="keymap-hands"><span data-i18n="leftHand"></span><span data-i18n="rightHand"></span></div><div class="keymap-scroll" tabindex="0" role="region" data-i18n-label="showKeymap"><div id="keymap"></div></div><p class="keymap-shift"><kbd>Shift</kbd><span data-i18n="shiftExample"></span></p><small data-i18n="numberedHint"></small></div>
      </details>
      <div class="piano-scroll" id="piano-scroll">
        <div class="piano-surface">
          <div class="roll"><canvas id="roll" role="img" data-i18n-label="roll"></canvas><div class="roll-empty" id="empty"><span class="empty-glyph">♫</span><strong data-i18n="emptyTitle"></strong><span data-i18n="emptyHint"></span></div><div class="roll-label"><span class="dot bass"></span><span data-i18n="bass"></span><span class="dot treble"></span><span data-i18n="treble"></span></div><span class="time-guide" data-i18n="playhead"></span></div>
          <div class="keyboard" id="keyboard" data-i18n-label="keyboard"></div>
        </div>
      </div>
      <div class="transport">
        <div class="transport-top"><div class="playback-buttons"><button class="icon-button" id="restart" data-i18n-label="restart" disabled>${icon('rewind')}</button><button class="play-button" id="play" data-i18n-label="play" disabled>${icon('play')}</button><span class="time"><span id="current-time">0:00</span><span class="time-divider">/</span><span id="duration">0:00</span></span></div>
        <div class="listen-mode" role="group" data-i18n-label="listenMode"><button id="piano-mode" class="selected" aria-pressed="true" data-i18n="pianoMode"></button><button id="original-mode" aria-pressed="false" data-i18n="originalMode"></button></div>
        <div class="audio-settings"><label class="speed-label"><span class="sr-only" data-i18n="speed"></span><select id="speed" data-i18n-label="speed"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected data-i18n="normalSpeed"></option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label class="volume-label">${icon('sound')}<span class="sr-only" data-i18n="volume"></span><input type="range" id="volume" min="0" max="1" step="0.01" value="0.65" data-i18n-label="volume"></label></div></div>
        <input type="range" id="seek" min="0" max="1" step="0.01" value="0" data-i18n-label="seek" disabled>
      </div>
      <div class="instrument-footer"><span><span class="live-dot"></span><span id="instrument-status" data-i18n="pianoReady"></span></span><span class="desktop-hint"><span data-i18n="clickKeys"></span><span id="piano-shortcuts"><span class="footer-separator">·</span><kbd>A</kbd>–<kbd>L</kbd> <span data-i18n="whiteKeys"></span></span><span class="footer-separator">·</span><kbd data-i18n="space"></kbd> <span data-i18n="playPause"></span></span><span class="mobile-hint" data-i18n="mobileHint"></span></div>
    </section>
    <footer class="page-footer"><p data-i18n="footer"></p><span data-i18n="limitations"></span><a href="./piano/README.txt" target="_blank" rel="noopener" data-i18n="sampleCredit"></a></footer>
  </main>
  <div class="drop-overlay" id="drop-overlay" hidden><span>${icon('upload')}</span><h2 data-i18n="dropTitle"></h2><p data-i18n="dropPrivacy"></p></div>
`;
applyTranslations();

function el<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id) as T; }
el<HTMLSelectElement>('language').value = locale;
el<HTMLSelectElement>('language').onchange = event => { setLocale((event.target as HTMLSelectElement).value); applyTranslations(); renderNotation(); };
const audio = new PianoAudio();
const keys = pianoKeys();
let notes: Note[] = [];
let duration = 0;
let position = 0;
let songName = '';
let fileUrl = '';
let mode: 'piano' | 'original' = 'piano';
let worker: Worker | undefined;
let request: AbortController | undefined;
let songModelReady = false;
let job = 0;
let busy = false;
let starting = false;
let dirty = true;
const held = new Map<number, { stop?: () => void }>();
const pressed = new Map<string, number>();
let notation: 'piano' | 'numbered' = 'piano';
let tonic = 0;
try {
  if (localStorage.getItem('echo-piano-notation') === 'numbered') notation = 'numbered';
  const savedKey = Number(localStorage.getItem('echo-piano-tonic'));
  if (Number.isInteger(savedKey) && savedKey >= 0 && savedKey < 12) tonic = savedKey;
} catch { /* Storage may be unavailable. */ }
let modelCheck = Promise.resolve();
if (import.meta.env.VITE_BROWSER_ONLY === '1') {
  el<HTMLSelectElement>('transcription-mode').value = 'instrument';
  el<HTMLSelectElement>('transcription-mode').options[0].disabled = true;
  setText(el('model-status'), 'browserOnly');
} else modelCheck = fetch('/api/health', { signal: AbortSignal.timeout(5000) }).then(response => response.json()).then(data => {
  songModelReady = data.service === 'echo-piano' && data.songMode;
  if (!songModelReady) throw new Error();
  setText(el('model-status'), 'modelReady');
}).catch(() => {
  el<HTMLSelectElement>('transcription-mode').value = 'instrument';
  setText(el('model-status'), 'modelMissing');
});
let computerKeys = keyboardMapping(notation, tonic);
const keyboard = el('keyboard');
for (const key of keys) {
  const button = document.createElement('button');
  button.className = `key ${key.black ? 'black' : 'white'}`;
  button.dataset.midi = String(key.midi);
  button.style.left = `${key.left / 52 * 100}%`;
  button.style.width = `${key.width / 52 * 100}%`;
  button.setAttribute('aria-pressed', 'false');
  button.innerHTML = '<span class="key-label"></span><span class="key-shortcut"></span>';
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); pressKey(key.midi); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => releaseKey(key.midi));
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); pressKey(key.midi); } });
  button.addEventListener('keyup', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); releaseKey(key.midi); } });
  button.addEventListener('blur', () => releaseKey(key.midi));
  keyboard.append(button);
}
const keyElements = Array.from(keyboard.children) as HTMLButtonElement[];

function renderNotation() {
  const numbered = notation === 'numbered';
  computerKeys = keyboardMapping(notation, tonic);
  keyboard.parentElement!.classList.toggle('numbered', numbered);
  el('key-control').hidden = el('numbered-guide').hidden = !numbered;
  el('piano-shortcuts').hidden = numbered;
  el<HTMLSelectElement>('major-key').value = String(tonic);
  setLabel(el('roll'), numbered ? 'numberedRoll' : 'roll');
  setText(document.querySelector('.song-info .eyebrow')!, numbered ? 'numberedEyebrow' : 'scoreEyebrow');
  for (const option of ['piano', 'numbered']) {
    el(`score-${option}`).classList.toggle('selected', option === notation);
    el(`score-${option}`).setAttribute('aria-pressed', String(option === notation));
  }
  keyElements.forEach(button => {
    const pitch = Number(button.dataset.midi);
    const shortcut = Object.keys(computerKeys).filter(key => computerKeys[key] === pitch).join(' ').toUpperCase();
    const label = button.querySelector<HTMLElement>('.key-label')!;
    const { degree, octave } = numberedNote(pitch, tonic);
    label.textContent = numbered ? degree : pitch % 12 === 0 ? noteName(pitch) : '';
    label.dataset.above = numbered && octave > 0 ? Array(octave).fill('·').join('\n') : '';
    label.dataset.below = numbered && octave < 0 ? Array(-octave).fill('·').join('\n') : '';
    button.classList.toggle('chromatic', numbered && degree.startsWith('♯'));
    button.classList.toggle('mapped', !!shortcut);
    button.classList.toggle('shared-shortcut', shortcut.length > 1);
    button.querySelector('.key-shortcut')!.textContent = shortcut;
    button.setAttribute('aria-label', `${noteName(pitch)}${numbered ? ` · ${t('numberedKeyLabel', { degree, octave: octave > 0 ? `+${octave}` : octave })}` : ''}${shortcut ? ` · ${shortcut}` : ''}`);
  });
  if (numbered) {
    const rows: (string | [string, number])[][] = [
      [...'`1234567890-=', ['⌫', 8]],
      [['Tab', 6], ...'qwertyuiop[]', ['\\', 6]],
      [['Caps', 7], ..."asdfghjkl;'", ['Enter', 9]],
      [['Shift', 9], ...'zxcvbnm,./', ['Shift', 11]],
      [['Ctrl', 5], ['⌘', 5], ['Alt', 5], ['Space', 25], ['Alt', 5], ['⌘', 5], ['Fn', 5], ['Ctrl', 5]],
    ];
    el('keymap').innerHTML = rows.map((row, index) => `<div class="keymap-row"${index > 0 && index < 4 ? ` role="group" aria-label="${t((['highOctave', 'middleOctave', 'lowOctave'] as const)[index - 1])}"` : ''}>${row.map(item => {
      const [key, units] = typeof item === 'string' ? [item, 4] : item;
      const pitch = computerKeys[key];
      const mapped = pitch !== undefined;
      const hand = numberedRows.some(row => row.slice(0, 4).includes(key)) ? 'left' : 'right';
      const { degree, octave } = numberedNote(pitch ?? 60, tonic);
      return `<kbd class="keymap-key${mapped ? ` keymap-${hand}` : ''}" style="--units:${units}"${mapped ? ` data-shortcut="${key}"` : ''}><span>${key.length === 1 ? key.toUpperCase() : key}</span>${mapped ? `<b class="keymap-degree" data-above="${Array(Math.max(0, octave)).fill('·').join('\n')}" data-below="${Array(Math.max(0, -octave)).fill('·').join('\n')}" aria-label="${t('numberedKeyLabel', { degree, octave })}">${degree}</b><small>${noteName(pitch)}</small>` : ''}</kbd>`;
    }).join('')}</div>`).join('');
  }
  dirty = true;
}
function releaseManualKeys() {
  for (const pitch of held.keys()) releaseKey(pitch);
  pressed.clear();
}
function changeNotation(next: typeof notation, key = tonic) {
  releaseManualKeys();
  notation = next;
  tonic = key;
  renderNotation();
  try {
    localStorage.setItem('echo-piano-notation', notation);
    localStorage.setItem('echo-piano-tonic', String(tonic));
  } catch { /* Keep the in-memory preference. */ }
  centerKeyboard();
}
function centerKeyboard() {
  const middle = keys[60 + (notation === 'numbered' ? tonic : 0) - 21];
  el('piano-scroll').scrollLeft = (middle.left + middle.width / 2) / 52 * keyboard.clientWidth - el('piano-scroll').clientWidth / 2;
}
el('score-piano').onclick = () => changeNotation('piano');
el('score-numbered').onclick = () => changeNotation('numbered');
el<HTMLSelectElement>('major-key').onchange = event => {
  const key = Number((event.target as HTMLSelectElement).value);
  if (Number.isInteger(key) && key >= 0 && key < 12) changeNotation(notation, key);
};
renderNotation();

function message(key: MessageKey, error = false, params: Params = {}) { setText(el('message'), key, params); el('message').classList.toggle('error', error); }
async function pressKey(pitch: number) {
  if (held.has(pitch)) return;
  const state: { stop?: () => void } = {};
  held.set(pitch, state);
  dirty = true;
  try { await audio.ready(); if (held.get(pitch) === state) state.stop = audio.strike(pitch); }
  catch (error) { message('playbackFailed', true, { reason: errorReason(error) }); releaseKey(pitch); }
}
function releaseKey(pitch: number) { held.get(pitch)?.stop?.(); held.delete(pitch); dirty = true; }
function updateControls() {
  el<HTMLButtonElement>('demo').disabled = busy;
  el<HTMLButtonElement>('video-import').disabled = busy;
  el<HTMLButtonElement>('play').disabled = busy || !duration || (mode === 'piano' && !notes.length);
  el('play').innerHTML = icon(audio.playing || starting ? 'pause' : 'play');
  setLabel(el('play'), audio.playing || starting ? 'pause' : 'play');
  el<HTMLButtonElement>('restart').disabled = !duration || busy;
  el<HTMLInputElement>('seek').disabled = !duration || busy;
  el<HTMLButtonElement>('export').disabled = !notes.length || busy;
  el('empty').hidden = notes.length > 0;
  setText(el('instrument-status'), busy ? 'listening' : audio.playing ? (mode === 'piano' ? 'pianoPlaying' : 'originalPlaying') : notes.length ? 'scoreReady' : 'pianoReady');
  el('instrument-status').parentElement!.classList.toggle('is-playing', audio.playing);
  dirty = true;
}
function pause() { if (audio.playing) position = Math.min(duration, audio.time); audio.pause(); starting = false; updateControls(); }
async function play() {
  if (audio.playing || starting) { pause(); return; }
  if (!duration || busy || (mode === 'piano' && !notes.length)) return;
  if (position >= duration - .01) position = 0;
  starting = true;
  updateControls();
  try { await audio.play(notes, position, Number(el<HTMLSelectElement>('speed').value), mode); }
  catch (error) { message('playbackFailed', true, { reason: errorReason(error) }); }
  starting = false;
  updateControls();
}
async function seek(time: number) {
  const playing = audio.playing || starting;
  pause();
  position = Math.max(0, Math.min(duration, time));
  dirty = true;
  if (playing) await play();
}
function cancel() {
  job++;
  request?.abort();
  request = undefined;
  worker?.terminate();
  worker = undefined;
  busy = false;
  el('processing').hidden = true;
  updateControls();
}
function finish(result: Note[], song: boolean) {
  notes = result;
  cancel();
  el<HTMLProgressElement>('progress').value = 1;
  el('percent').textContent = '100%';
  const melody = notes.filter(note => note.part === 'melody').length;
  setText(el('note-count'), song ? 'songSummary' : 'noteSummary', { count: notes.length, melody, bass: notes.length - melody, duration: formatTime(duration) });
  message(notes.length ? (song ? 'songComplete' : 'complete') : 'noNotes');
  changeMode(notes.length ? 'piano' : 'original');
  updateControls();
}
async function importAudio(file: File, demoTitle?: MessageKey, expectedDuration = 0, fromLink = false) {
  if (!file.size) { message('emptyFile', true); return; }
  const song = el<HTMLSelectElement>('transcription-mode').value === 'song';
  if (song && !songModelReady) { if (fromLink) cancel(); message('songUnavailable', true); return; }
  cancel();
  pause();
  const currentJob = job;
  busy = true;
  el('processing').hidden = false;
  setText(el('process-label'), 'decoding');
  el<HTMLProgressElement>('progress').value = 0;
  el('percent').textContent = '0%';
  setRawText(el('message'), ''); el('message').classList.remove('error');
  updateControls();
  let decoding = true;
  try {
    const decoded = await decodeAudio(file, audio.context);
    decoding = false;
    if (currentJob !== job) return;
    if (fromLink && decoded.duration > 20 * 60) throw new Error('videoTooLarge');
    if (decoded.duration < expectedDuration - 2) throw new Error('videoIncomplete');
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = URL.createObjectURL(file);
    audio.original.src = fileUrl;
    duration = decoded.duration;
    position = 0;
    notes = [];
    songName = file.name.replace(/\.[^.]+$/, '');
    if (demoTitle) setText(el('song-name'), demoTitle);
    else setRawText(el('song-name'), songName);
    setText(el('note-count'), 'recognizing', { duration: formatTime(duration) });
    el('duration').textContent = formatTime(duration);
    el<HTMLInputElement>('seek').max = String(duration);
    setText(el('process-label'), 'loadingModel');
    updateControls();
    if (song) {
      request = new AbortController();
      const response = await fetch('/api/transcribe', { method: 'POST', body: file, signal: request.signal, headers: { 'Content-Type': 'application/octet-stream' } });
      if (!response.ok || !response.body) throw new Error(response.status === 409 ? 'songBusy' : response.status === 413 ? 'songSize' : 'songServiceFailed');
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = '';
      while (true) {
        const { value, done } = await reader.read();
        if (currentJob !== job) { await reader.cancel(); return; }
        if (done) throw new Error('songDisconnected');
        pending += value;
        const lines = pending.split('\n');
        pending = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);
          if (data.type === 'complete') { finish(data.notes, true); return; }
          if (data.type === 'error') throw new Error(isMessageKey(data.code) ? data.code : data.message);
          if (isMessageKey(data.stage)) setText(el('process-label'), data.stage, { time: data.time ?? '' });
          else setRawText(el('process-label'), String(data.label ?? ''));
          el<HTMLProgressElement>('progress').value = data.progress;
          el('percent').textContent = `${Math.round(data.progress * 100)}%`;
        }
      }
    }
    worker = new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (currentJob !== job) return;
      if (data.type === 'progress') {
        setText(el('process-label'), 'inference');
        el<HTMLProgressElement>('progress').value = data.progress;
        el('percent').textContent = `${Math.round(data.progress * 100)}%`;
      } else if (data.type === 'complete') {
        finish(data.notes, false);
      } else if (data.type === 'error') fail(data.message);
    };
    worker.onerror = event => { if (currentJob === job) fail(event.message); };
    worker.postMessage({ samples: decoded.samples, base: new URL(import.meta.env.BASE_URL, location.href).href }, [decoded.samples.buffer]);
  } catch (error) {
    if (currentJob === job) fail(error instanceof Error ? error.message : String(error), decoding);
  }
}
function fail(reason: string, decoding = false) {
  console.error('Audio transcription:', reason);
  cancel();
  setText(el('note-count'), notes.length ? 'noteCount' : 'noScore', { count: notes.length });
  message(decoding ? (reason === 'audioTooShort' ? 'audioTooShort' : 'decodingFailed') : 'transcriptionFailed', true, { reason: errorReason(reason) });
  if (duration && !notes.length) changeMode('original');
}
function changeMode(next: typeof mode) {
  const playing = audio.playing || starting;
  pause();
  mode = next;
  for (const option of ['piano', 'original']) {
    el(`${option}-mode`).classList.toggle('selected', option === mode);
    el(`${option}-mode`).setAttribute('aria-pressed', String(option === mode));
  }
  updateControls();
  if (playing) void play();
}

el('choose').onclick = () => el<HTMLInputElement>('file').click();
el<HTMLInputElement>('file').onchange = event => { const input = event.target as HTMLInputElement; if (input.files?.[0]) void importAudio(input.files[0]); input.value = ''; };
el('demo').onclick = async () => {
  const option = el<HTMLSelectElement>('demo-song').selectedOptions[0];
  await importRemote(`${import.meta.env.BASE_URL}${option.value}`, option.dataset.i18n as MessageKey);
};
el<HTMLFormElement>('video-form').onsubmit = event => {
  event.preventDefault();
  if (!busy) void importRemote(el<HTMLInputElement>('video-url').value.trim());
};
async function importRemote(url: string, demoTitle?: MessageKey) {
  cancel();
  pause();
  const currentJob = job;
  request = new AbortController();
  busy = true;
  el('processing').hidden = false;
  setText(el('process-label'), demoTitle ? 'loadingDemo' : 'loadingVideo');
  el<HTMLProgressElement>('progress').value = 0;
  el('percent').textContent = '0%';
  setRawText(el('message'), '');
  el('message').classList.remove('error');
  updateControls();
  if (demoTitle) el<HTMLSelectElement>('transcription-mode').value = 'instrument';
  try {
    const response = demoTitle ? await fetch(url, { signal: request.signal }) : await fetchAudioLink(url, request.signal);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(isMessageKey(data.error) ? data.error : 'videoUnavailable');
    }
    const blob = demoTitle ? await response.blob() : await readLinkedAudio(response);
    await modelCheck;
    if (currentJob !== job) return;
    if (!blob.size) throw new Error('videoUnavailable');
    if (demoTitle) el<HTMLSelectElement>('transcription-mode').value = 'instrument';
    let title = demoTitle ? t(demoTitle) : response.headers.get('x-audio-title') || new URL(url).pathname.split('/').pop()?.replace(/\.[^.]+$/, '') || 'Audio';
    if (!demoTitle) { try { title = decodeURIComponent(title); } catch { /* A filename may contain a literal percent sign. */ } }
    await importAudio(new File([blob], `${title}.${demoTitle ? 'mp3' : 'm4a'}`, { type: blob.type }), demoTitle, Number(response.headers.get('x-audio-duration')) || 0, !demoTitle);
  } catch (error) {
    if (currentJob === job) { cancel(); message(demoTitle ? 'demoFailed' : 'videoFailed', true, { reason: errorReason(error) }); }
  }
}
el('cancel').onclick = () => { cancel(); setText(el('note-count'), notes.length ? 'noteCount' : 'cancelledCount', { count: notes.length }); message('cancelled'); if (duration && !notes.length) changeMode('original'); };
el('play').onclick = () => void play();
el('restart').onclick = () => void seek(0);
el<HTMLInputElement>('seek').oninput = event => void seek(Number((event.target as HTMLInputElement).value));
el<HTMLSelectElement>('speed').onchange = () => void seek(audio.playing ? audio.time : position);
el<HTMLInputElement>('volume').oninput = event => audio.setVolume(Number((event.target as HTMLInputElement).value));
el('piano-mode').onclick = () => changeMode('piano');
el('original-mode').onclick = () => changeMode('original');
el('export').onclick = async () => {
  const { Midi } = await import('@tonejs/midi');
  const midi = new Midi();
  midi.name = 'Echo Piano';
  for (const part of new Set(notes.map(note => note.part))) {
    const track = midi.addTrack();
    track.name = part === 'melody' ? 'Melody' : part === 'bass' ? 'Bass' : 'Piano';
    track.instrument.number = 0;
    for (const note of notes.filter(note => note.part === part)) track.addNote({ midi: note.pitch, time: note.start, duration: note.end - note.start, velocity: Math.min(1, Math.max(0, note.velocity)) });
  }
  const url = URL.createObjectURL(new Blob([new Uint8Array(midi.toArray())], { type: 'audio/midi' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${songName || 'echo-piano'}.mid`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
};

let dragDepth = 0;
window.addEventListener('dragenter', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); dragDepth++; el('drop-overlay').hidden = false; } });
window.addEventListener('dragover', event => { if (event.dataTransfer?.types.includes('Files')) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; } });
window.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; el('drop-overlay').hidden = true; } });
window.addEventListener('drop', event => { event.preventDefault(); dragDepth = 0; el('drop-overlay').hidden = true; const file = event.dataTransfer?.files[0]; if (file) void importAudio(file); });
window.addEventListener('keydown', event => {
  const target = event.target;
  if (target instanceof HTMLElement && (/INPUT|SELECT|TEXTAREA/.test(target.tagName) || target.isContentEditable)) return;
  if (event.code === 'Space' && !(target instanceof HTMLButtonElement) && !(target instanceof HTMLElement && target.closest('summary'))) { event.preventDefault(); if (!event.repeat) void play(); }
  const punctuation: Record<string, string> = { Semicolon: ';', Comma: ',', Period: '.', Slash: '/' };
  const key = event.code.startsWith('Key') ? event.code.slice(3).toLowerCase() : punctuation[event.code] ?? event.key.toLowerCase();
  const pitch = computerKeys[key];
  if (pitch && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    const playedPitch = pitch + Number(notation === 'numbered' && event.shiftKey);
    if (!event.repeat && !pressed.has(event.code || event.key.toLowerCase())) { pressed.set(event.code || event.key.toLowerCase(), playedPitch); void pressKey(playedPitch); }
  }
});
window.addEventListener('keyup', event => {
  const key = event.code || event.key.toLowerCase();
  const pitch = pressed.get(key);
  pressed.delete(key);
  if (pitch && ![...pressed.values()].includes(pitch)) releaseKey(pitch);
});
window.addEventListener('blur', () => { releaseManualKeys(); dragDepth = 0; el('drop-overlay').hidden = true; });

const canvas = el<HTMLCanvasElement>('roll');
const ctx = canvas.getContext('2d')!;
let width = 0;
let height = 0;
new ResizeObserver(() => {
  width = canvas.clientWidth; height = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * ratio; canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  dirty = true;
}).observe(canvas);

function draw() {
  requestAnimationFrame(draw);
  if (!dirty && !audio.playing) return;
  dirty = false;
  const time = audio.playing ? Math.min(duration, audio.time) : position;
  if (audio.playing && time >= duration) { pause(); position = duration; }
  el('current-time').textContent = formatTime(time);
  el<HTMLInputElement>('seek').value = String(time);
  el('seek').style.setProperty('--progress', `${duration ? time / duration * 100 : 0}%`);
  ctx.clearRect(0, 0, width, height);
  const horizon = 5;
  for (const key of keys) {
    if (key.black) continue;
    const x = key.left / 52 * width;
    ctx.strokeStyle = key.midi % 12 === 0 ? '#344039' : '#252f29';
    ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  for (let second = Math.ceil(time); second < time + horizon; second++) {
    const y = height - (second - time) / horizon * height;
    ctx.strokeStyle = '#30382f'; ctx.lineWidth = .5;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    ctx.fillStyle = '#727d70'; ctx.font = '9px monospace'; ctx.fillText(formatTime(second), 7, y - 6);
  }
  const active = new Set(held.keys());
  // ponytail: linear scan is enough for song-sized scores; index time windows for hour-long scores.
  for (const note of visibleNotes(notes, time, horizon)) {
    const key = keys[note.pitch - 21];
    if (!key) continue;
    const bottom = height - (note.start - time) / horizon * height;
    const top = height - (note.end - time) / horizon * height;
    const x = key.left / 52 * width + 1;
    const w = key.width / 52 * width - 2;
    const playing = note.start <= time && note.end > time;
    if (playing) active.add(note.pitch);
    ctx.fillStyle = note.pitch < 60 ? (playing ? '#e4c98c' : '#b9a276') : (playing ? '#c4edd0' : '#83aa91');
    ctx.globalAlpha = .6 + note.velocity * .4;
    ctx.beginPath(); ctx.roundRect(x, top, Math.max(w, 3), Math.max(bottom - top - 2, 4), 3); ctx.fill();
    ctx.globalAlpha = 1;
    if (w > 10 && Math.min(bottom, height) - Math.max(top, 0) > 22) {
      ctx.fillStyle = '#22342b'; ctx.font = notation === 'numbered' ? '11px sans-serif' : '9px sans-serif'; ctx.textAlign = 'center';
      const { degree, octave } = numberedNote(note.pitch, tonic);
      const y = Math.max(top + 13, 12) + (notation === 'numbered' ? Math.max(octave, 0) * 3 : 0);
      ctx.fillText(notation === 'numbered' ? degree : noteName(note.pitch), x + w / 2, y, w);
      if (notation === 'numbered') for (let dot = 0; dot < Math.abs(octave); dot++) {
        ctx.beginPath(); ctx.arc(x + w / 2, y + (octave > 0 ? -12 - dot * 3 : 4 + dot * 3), 1, 0, Math.PI * 2); ctx.fill();
      }
      ctx.textAlign = 'left';
    }
  }
  keyElements.forEach((key, index) => { const on = active.has(index + 21); key.classList.toggle('active', on); key.classList.toggle('low', index + 21 < 60); key.setAttribute('aria-pressed', String(on)); });
}
requestAnimationFrame(draw);
// Centre the playable computer-keyboard octave on narrow screens.
centerKeyboard();
updateControls();
