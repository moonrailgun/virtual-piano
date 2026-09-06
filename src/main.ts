import './style.css';
import { PianoAudio, decodeAudio } from './audio';
import { formatTime, noteName, pianoKeys, visibleNotes, type Note } from './music';

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
    <a class="brand" href="./" aria-label="余音首页"><span class="brand-mark"><i></i><i></i><i></i><i></i></span><b>余音</b><span class="brand-en">ECHO PIANO</span></a>
    <span class="local-badge"><span></span> 本地运行 · 音频不离开设备</span>
  </header>
  <main>
    <section class="intro">
      <div><p class="eyebrow">A LITTLE CLOSER TO THE MUSIC</p><h1>让每一首歌，<em>落在琴键上。</em></h1></div>
      <p class="intro-copy">拖入一段喜欢的旋律。<br>让声音成为曲谱，让聆听变成演奏。</p>
    </section>
    <section class="import-panel" id="drop-zone" aria-label="音频导入区域">
      <button class="upload-target" id="choose"><span class="upload-icon">${icon('upload')}</span><span><strong>把音乐拖到这里<span class="choose-hint">，或点击选择</span></strong><small>MP3 / WAV / M4A / OGG · 自动转成钢琴曲谱</small></span></button>
      <div class="demo-wrap"><span>还没有准备好音乐？</span><button class="text-button" id="demo">听听一段示例 <span aria-hidden="true">↗</span></button></div>
      <input id="file" type="file" accept="audio/*,.mp3,.wav,.m4a,.ogg,.flac,.aac" hidden>
    </section>
    <div class="transcription-options"><label for="transcription-mode">音频类型</label><select id="transcription-mode"><option value="song">歌曲 · 主旋律 + 低音</option><option value="instrument">纯乐器 · 多音转谱</option></select><span id="model-status">正在连接本机歌曲模型…</span></div>
    <section id="processing" class="processing" hidden>
      <span class="spinner"></span><div><strong id="process-label">正在读取音频…</strong><progress id="progress" max="1" value="0" aria-label="转谱进度"></progress></div><span id="percent">0%</span><button id="cancel" class="text-button">取消</button>
    </section>
    <p id="message" class="message" role="status" aria-live="polite"></p>
    <section class="instrument" aria-label="虚拟钢琴与曲谱">
      <div class="score-header">
        <div class="song-info"><span class="record-icon">${icon('music')}</span><div><p class="eyebrow">YOUR PIANO ROLL</p><h2 id="song-name">一首歌的另一种模样</h2></div></div>
        <div class="score-actions"><span class="note-count" id="note-count">88 键 · 无限旋律</span><button id="export" class="outline-button" disabled>${icon('download')} 导出 MIDI</button></div>
      </div>
      <div class="piano-scroll" id="piano-scroll">
        <div class="piano-surface">
          <div class="roll"><canvas id="roll" role="img" aria-label="钢琴卷帘谱：音符向下落到对应琴键"></canvas><div class="roll-empty" id="empty"><span class="empty-glyph">♫</span><strong>音乐，从这里开始</strong><span>导入音频后，音符会沿着琴键缓缓落下</span></div><div class="roll-label"><span class="dot bass"></span> 低音 <span class="dot treble"></span> 高音</div><span class="time-guide">↓ 演奏线</span></div>
          <div class="keyboard" id="keyboard" aria-label="88 键钢琴"></div>
        </div>
      </div>
      <div class="transport">
        <div class="transport-top"><div class="playback-buttons"><button class="icon-button" id="restart" aria-label="回到开头" disabled>${icon('rewind')}</button><button class="play-button" id="play" aria-label="播放" disabled>${icon('play')}</button><span class="time"><span id="current-time">0:00</span><span class="time-divider">/</span><span id="duration">0:00</span></span></div>
        <div class="listen-mode" role="group" aria-label="试听音源"><button id="piano-mode" class="selected" aria-pressed="true">钢琴重奏</button><button id="original-mode" aria-pressed="false">原音对照</button></div>
        <div class="audio-settings"><label class="speed-label"><span class="sr-only">播放速度</span><select id="speed" aria-label="播放速度"><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1" selected>1× 速度</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label><label class="volume-label">${icon('sound')}<span class="sr-only">音量</span><input type="range" id="volume" min="0" max="1" step="0.01" value="0.65" aria-label="音量"></label></div></div>
        <input type="range" id="seek" min="0" max="1" step="0.01" value="0" aria-label="播放进度" disabled>
      </div>
      <div class="instrument-footer"><span><span class="live-dot"></span><span id="instrument-status">钢琴已就绪</span></span><span>点击琴键自由演奏 <span class="footer-separator">·</span> <kbd>A</kbd>–<kbd>L</kbd> 白键 <span class="footer-separator">·</span> <kbd>空格</kbd> 播放 / 暂停</span></div>
    </section>
    <footer class="page-footer"><p>每一个声音，都有它的形状。</p><span>歌曲模式提取主旋律与低音；纯乐器模式保留和弦。AI 转谱仍可能需要校正。</span><a href="./piano/README.txt" target="_blank" rel="noopener">Piano samples · Alexander Holm</a></footer>
  </main>
  <div class="drop-overlay" id="drop-overlay" hidden><span>${icon('upload')}</span><h2>松开，让音乐落下</h2><p>你的音频只会在这台设备上处理</p></div>
`;

function el<T extends HTMLElement = HTMLElement>(id: string) { return document.getElementById(id) as T; }
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
fetch('/api/health').then(response => response.json()).then(data => {
  songModelReady = data.service === 'echo-piano' && data.songMode;
  if (!songModelReady) throw new Error();
  el('model-status').textContent = '先分离人声与鼓点，再提取旋律 · 约需数分钟';
}).catch(() => {
  el<HTMLSelectElement>('transcription-mode').value = 'instrument';
  el('model-status').textContent = '歌曲模型未启动；运行 npm run setup:audio 后重启服务';
});
const computerKeys: Record<string, number> = { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
const keyboard = el('keyboard');
for (const key of keys) {
  const button = document.createElement('button');
  button.className = `key ${key.black ? 'black' : 'white'}`;
  button.dataset.midi = String(key.midi);
  button.style.left = `${key.left / 52 * 100}%`;
  button.style.width = `${key.width / 52 * 100}%`;
  button.setAttribute('aria-label', noteName(key.midi));
  button.setAttribute('aria-pressed', 'false');
  const shortcut = Object.keys(computerKeys).find(k => computerKeys[k] === key.midi);
  button.innerHTML = `<span class="key-label">${key.midi % 12 === 0 ? noteName(key.midi) : ''}</span><span class="key-shortcut">${shortcut?.toUpperCase() ?? ''}</span>`;
  button.addEventListener('pointerdown', event => { event.preventDefault(); button.setPointerCapture(event.pointerId); pressKey(key.midi); });
  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(event, () => releaseKey(key.midi));
  button.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); pressKey(key.midi); } });
  button.addEventListener('keyup', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); releaseKey(key.midi); } });
  button.addEventListener('blur', () => releaseKey(key.midi));
  keyboard.append(button);
}
const keyElements = Array.from(keyboard.children) as HTMLButtonElement[];

function message(text: string, error = false) { el('message').textContent = text; el('message').classList.toggle('error', error); }
async function pressKey(pitch: number) {
  if (held.has(pitch)) return;
  const state: { stop?: () => void } = {};
  held.set(pitch, state);
  dirty = true;
  try { await audio.ready(); if (held.get(pitch) === state) state.stop = audio.strike(pitch); }
  catch (error) { message(String(error), true); releaseKey(pitch); }
}
function releaseKey(pitch: number) { held.get(pitch)?.stop?.(); held.delete(pitch); dirty = true; }
function updateControls() {
  el<HTMLButtonElement>('play').disabled = busy || !duration || (mode === 'piano' && !notes.length);
  el('play').innerHTML = icon(audio.playing || starting ? 'pause' : 'play');
  el('play').setAttribute('aria-label', audio.playing || starting ? '暂停' : '播放');
  el<HTMLButtonElement>('restart').disabled = !duration || busy;
  el<HTMLInputElement>('seek').disabled = !duration || busy;
  el<HTMLButtonElement>('export').disabled = !notes.length || busy;
  el('empty').hidden = notes.length > 0;
  el('instrument-status').textContent = busy ? '正在聆听你的音乐' : audio.playing ? (mode === 'piano' ? '钢琴演奏中' : '原音播放中') : notes.length ? '曲谱已就绪' : '钢琴已就绪';
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
  catch (error) { message(`无法播放：${error instanceof Error ? error.message : error}`, true); }
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
  el('note-count').textContent = song ? `${melody} 旋律 · ${notes.length - melody} 低音 · ${formatTime(duration)}` : `${notes.length} 个音符 · ${formatTime(duration)}`;
  message(notes.length ? (song ? '主旋律与低音已提取。歌曲模式保留两个声部，前奏和无主唱段落可能较稀疏。' : '转谱完成。按空格开始演奏，也可以切换原音对照。') : '没有识别出清晰的音符。可以试听原音，或尝试一段更清晰的乐器录音。');
  changeMode(notes.length ? 'piano' : 'original');
  updateControls();
}
async function importAudio(file: File) {
  if (!file.size) { message('文件是空的，请选择一份音频文件。', true); return; }
  const song = el<HTMLSelectElement>('transcription-mode').value === 'song';
  if (song && !songModelReady) { message('歌曲模式需要本机模型服务。请运行 npm run setup:audio 并重启 npm run dev，或选择纯乐器模式。', true); return; }
  cancel();
  pause();
  const currentJob = job;
  busy = true;
  el('processing').hidden = false;
  el('process-label').textContent = '正在解码音频…';
  el<HTMLProgressElement>('progress').value = 0;
  el('percent').textContent = '0%';
  message('');
  updateControls();
  let decoding = true;
  try {
    const decoded = await decodeAudio(file, audio.context);
    decoding = false;
    if (currentJob !== job) return;
    if (fileUrl) URL.revokeObjectURL(fileUrl);
    fileUrl = URL.createObjectURL(file);
    audio.original.src = fileUrl;
    duration = decoded.duration;
    position = 0;
    notes = [];
    songName = file.name.replace(/\.[^.]+$/, '');
    el('song-name').textContent = songName;
    el('note-count').textContent = `${formatTime(duration)} · 识别中`;
    el('duration').textContent = formatTime(duration);
    el<HTMLInputElement>('seek').max = String(duration);
    el('process-label').textContent = '正在加载转谱模型…';
    updateControls();
    if (song) {
      request = new AbortController();
      const response = await fetch('/api/transcribe', { method: 'POST', body: file, signal: request.signal, headers: { 'Content-Type': 'application/octet-stream' } });
      if (!response.ok || !response.body) throw new Error(response.status === 409 ? '本机仍在结束上一首歌，请稍后重新导入。' : response.status === 413 ? '歌曲模式支持 100 MB 以内的音频。' : '本机歌曲服务不可用，请检查运行终端。');
      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let pending = '';
      while (true) {
        const { value, done } = await reader.read();
        if (currentJob !== job) { await reader.cancel(); return; }
        if (done) throw new Error('本机模型连接中断，请重新导入。');
        pending += value;
        const lines = pending.split('\n');
        pending = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);
          if (data.type === 'complete') { finish(data.notes, true); return; }
          if (data.type === 'error') throw new Error(data.message);
          el('process-label').textContent = data.label;
          el<HTMLProgressElement>('progress').value = data.progress;
          el('percent').textContent = `${Math.round(data.progress * 100)}%`;
        }
      }
    }
    worker = new Worker(new URL('./transcribe.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = ({ data }) => {
      if (currentJob !== job) return;
      if (data.type === 'progress') {
        el('process-label').textContent = '正在识别音高、和弦与节奏…';
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
  el('note-count').textContent = notes.length ? `${notes.length} 个音符` : '尚无曲谱';
  message(decoding ? '无法解码这个文件。请确认它是有效的 MP3、WAV 或其他浏览器支持的音频。' : `转谱失败，请重新导入重试。${reason}`, true);
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
  el<HTMLSelectElement>('transcription-mode').value = 'instrument';
  const button = el<HTMLButtonElement>('demo');
  button.disabled = true;
  try { const response = await fetch(`${import.meta.env.BASE_URL}demo.mp3`); if (!response.ok) throw new Error(); await importAudio(new File([await response.blob()], '雨后 · 钢琴小品.mp3', { type: 'audio/mpeg' })); }
  catch { message('示例加载失败，请重试。', true); }
  finally { button.disabled = false; }
};
el('cancel').onclick = () => { cancel(); el('note-count').textContent = notes.length ? `${notes.length} 个音符` : '识别已取消'; message('已取消转谱，可以重新导入音频。'); if (duration && !notes.length) changeMode('original'); };
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
  if (event.code === 'Space' && !(target instanceof HTMLButtonElement)) { event.preventDefault(); if (!event.repeat) void play(); }
  const pitch = computerKeys[event.key.toLowerCase()];
  if (pitch && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); void pressKey(pitch); }
});
window.addEventListener('keyup', event => { const pitch = computerKeys[event.key.toLowerCase()]; if (pitch) releaseKey(pitch); });
window.addEventListener('blur', () => { for (const pitch of held.keys()) releaseKey(pitch); dragDepth = 0; el('drop-overlay').hidden = true; });

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
    if (w > 12 && bottom - top > 22) { ctx.fillStyle = '#22342b'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(noteName(note.pitch), x + w / 2, Math.max(top + 13, 12)); ctx.textAlign = 'left'; }
  }
  keyElements.forEach((key, index) => { const on = active.has(index + 21); key.classList.toggle('active', on); key.classList.toggle('low', index + 21 < 60); key.setAttribute('aria-pressed', String(on)); });
}
requestAnimationFrame(draw);
// Centre the playable computer-keyboard octave on narrow screens.
el('piano-scroll').scrollLeft = Math.max(0, (keyboard.clientWidth - el('piano-scroll').clientWidth) * .52);
updateControls();
