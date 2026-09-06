export const en = {
  title: 'Echo Piano',
  description: 'Turn your music into a piano score. Drop in an audio file to transcribe locally, listen, play, and export MIDI.',
  home: 'Echo Piano home',
  language: 'Language',
  localBadge: 'Local processing · Your audio stays on your device',
  eyebrow: 'A LITTLE CLOSER TO THE MUSIC',
  heroLead: 'Every song, ',
  heroEmphasis: 'at your fingertips.',
  introFirst: 'Bring a melody you love.',
  introSecond: 'Turn sound into notes, and listening into playing.',
  importRegion: 'Import audio',
  dropMusic: 'Drop your music here',
  chooseHint: ', or browse files',
  formats: 'MP3 / WAV / M4A / OGG · Turn audio into a piano score',
  demoPrompt: 'Need something to play?',
  demo: 'Try a demo',
  audioType: 'Audio type',
  songMode: 'Song · Melody + bass',
  instrumentMode: 'Instrument · Polyphonic',
  modelConnecting: 'Connecting to the local song model…',
  browserOnly: 'Transcribe in your browser, best with clear instrument recordings. Enhanced song mode requires a local setup.',
  modelReady: 'Separates vocals and drums, then extracts melody · May take a few minutes',
  modelMissing: 'Song model is offline. Run npm run setup:audio and restart the server.',
  readingAudio: 'Reading audio…',
  progress: 'Transcription progress',
  cancel: 'Cancel',
  instrumentRegion: 'Virtual piano and score',
  scoreEyebrow: 'YOUR PIANO ROLL',
  emptySong: 'A new way to hear your music',
  emptyCount: '88 keys · Endless melodies',
  export: 'Export MIDI',
  roll: 'Piano roll: notes fall onto their corresponding keys',
  emptyTitle: 'Music starts here',
  emptyHint: 'Import audio and watch the notes fall onto the keys',
  bass: 'Bass',
  treble: 'Treble',
  playhead: '↓ Play line',
  keyboard: '88-key piano',
  restart: 'Back to the beginning',
  play: 'Play',
  pause: 'Pause',
  listenMode: 'Playback source',
  pianoMode: 'Piano',
  originalMode: 'Original',
  speed: 'Playback speed',
  normalSpeed: '1× Speed',
  volume: 'Volume',
  seek: 'Playback position',
  pianoReady: 'Piano ready',
  listening: 'Listening to your music',
  pianoPlaying: 'Playing piano',
  originalPlaying: 'Playing original audio',
  scoreReady: 'Score ready',
  clickKeys: 'Click the keys to play',
  whiteKeys: 'white keys',
  space: 'Space',
  playPause: 'play / pause',
  mobileHint: 'Swipe the keyboard to explore · Tap to play',
  footer: 'Every sound has a shape.',
  limitations: 'Song mode extracts melody and bass; instrument mode preserves chords. AI transcriptions may need editing.',
  sampleCredit: 'Piano samples · Alexander Holm',
  dropTitle: 'Let go. Let the music fall.',
  dropPrivacy: 'Your audio is processed only on this device',
  playbackFailed: 'Unable to play: {reason}',
  noteCount: '{count} notes',
  noteSummary: '{count} notes · {duration}',
  songSummary: '{melody} melody · {bass} bass · {duration}',
  songComplete: 'Melody and bass extracted. Song mode keeps two parts; intros and sections without vocals may be sparse.',
  complete: 'Transcription complete. Press Space to play, or switch to the original audio.',
  noNotes: 'No clear notes detected. Listen to the original, or try a clearer instrument recording.',
  emptyFile: 'This file is empty. Please choose an audio file.',
  songUnavailable: 'Song mode needs the local model service. Run npm run setup:audio and restart npm run dev, or choose instrument mode.',
  decoding: 'Decoding audio…',
  recognizing: '{duration} · Transcribing',
  loadingModel: 'Loading the transcription model…',
  songBusy: 'The local service is finishing the previous song. Please import again shortly.',
  songSize: 'Song mode supports audio files up to 100 MB.',
  songServiceFailed: 'The local song service is unavailable. Check the terminal.',
  songDisconnected: 'The local model connection was interrupted. Please import again.',
  loadingSeparation: 'Loading the vocal separation model. The first run downloads model weights…',
  separating: 'Separating vocals, bass, and drums · {time}',
  trackingMelody: 'Tracking the main melody…',
  trackingBass: 'Extracting bass accompaniment…',
  songDuration: 'Song mode supports audio from 0.1 seconds to 30 minutes.',
  songProcessExited: 'The local transcription process exited. Check the terminal.',
  inference: 'Recognizing pitches, chords, and rhythm…',
  noScore: 'No score yet',
  decodingFailed: 'Unable to decode this file. Please choose a valid MP3, WAV, or another audio format supported by your browser.',
  transcriptionFailed: 'Transcription failed. Please import again. {reason}',
  demoFailed: 'Unable to load the demo. Please try again.',
  cancelledCount: 'Transcription cancelled',
  cancelled: 'Transcription cancelled. You can import another audio file.',
  samplesFailed: 'Unable to load piano samples. Please refresh and try again.',
  audioTooShort: 'This audio is too short. Please choose another file.',
} as const;

export type MessageKey = keyof typeof en;
export const zh: Record<MessageKey, string> = {
  title: '余音 · Echo Piano',
  description: '把一段音乐变成指尖的旋律。拖入音频，在本地转成钢琴曲谱，聆听、演奏并导出 MIDI。',
  home: '余音首页',
  language: '语言',
  localBadge: '本地运行 · 音频不离开设备',
  eyebrow: '离音乐，再近一点',
  heroLead: '让每一首歌，',
  heroEmphasis: '落在琴键上。',
  introFirst: '拖入一段喜欢的旋律。',
  introSecond: '让声音成为曲谱，让聆听变成演奏。',
  importRegion: '音频导入区域',
  dropMusic: '把音乐拖到这里',
  chooseHint: '，或点击选择',
  formats: 'MP3 / WAV / M4A / OGG · 自动转成钢琴曲谱',
  demoPrompt: '还没有准备好音乐？',
  demo: '听听一段示例',
  audioType: '音频类型',
  songMode: '歌曲 · 主旋律 + 低音',
  instrumentMode: '纯乐器 · 多音转谱',
  modelConnecting: '正在连接本机歌曲模型…',
  browserOnly: '在线版在浏览器中转谱，适合清晰乐器录音；歌曲增强模式需在本机运行',
  modelReady: '先分离人声与鼓点，再提取旋律 · 约需数分钟',
  modelMissing: '歌曲模型未启动；运行 npm run setup:audio 后重启服务',
  readingAudio: '正在读取音频…',
  progress: '转谱进度',
  cancel: '取消',
  instrumentRegion: '虚拟钢琴与曲谱',
  scoreEyebrow: '你的钢琴卷帘谱',
  emptySong: '一首歌的另一种模样',
  emptyCount: '88 键 · 无限旋律',
  export: '导出 MIDI',
  roll: '钢琴卷帘谱：音符向下落到对应琴键',
  emptyTitle: '音乐，从这里开始',
  emptyHint: '导入音频后，音符会沿着琴键缓缓落下',
  bass: '低音',
  treble: '高音',
  playhead: '↓ 演奏线',
  keyboard: '88 键钢琴',
  restart: '回到开头',
  play: '播放',
  pause: '暂停',
  listenMode: '试听音源',
  pianoMode: '钢琴重奏',
  originalMode: '原音对照',
  speed: '播放速度',
  normalSpeed: '1× 速度',
  volume: '音量',
  seek: '播放进度',
  pianoReady: '钢琴已就绪',
  listening: '正在聆听你的音乐',
  pianoPlaying: '钢琴演奏中',
  originalPlaying: '原音播放中',
  scoreReady: '曲谱已就绪',
  clickKeys: '点击琴键自由演奏',
  whiteKeys: '白键',
  space: '空格',
  playPause: '播放 / 暂停',
  mobileHint: '左右滑动琴键 · 点击自由弹奏',
  footer: '每一个声音，都有它的形状。',
  limitations: '歌曲模式提取主旋律与低音；纯乐器模式保留和弦。AI 转谱仍可能需要校正。',
  sampleCredit: '钢琴采样 · Alexander Holm',
  dropTitle: '松开，让音乐落下',
  dropPrivacy: '你的音频只会在这台设备上处理',
  playbackFailed: '无法播放：{reason}',
  noteCount: '{count} 个音符',
  noteSummary: '{count} 个音符 · {duration}',
  songSummary: '{melody} 旋律 · {bass} 低音 · {duration}',
  songComplete: '主旋律与低音已提取。歌曲模式保留两个声部，前奏和无主唱段落可能较稀疏。',
  complete: '转谱完成。按空格开始演奏，也可以切换原音对照。',
  noNotes: '没有识别出清晰的音符。可以试听原音，或尝试一段更清晰的乐器录音。',
  emptyFile: '文件是空的，请选择一份音频文件。',
  songUnavailable: '歌曲模式需要本机模型服务。请运行 npm run setup:audio 并重启 npm run dev，或选择纯乐器模式。',
  decoding: '正在解码音频…',
  recognizing: '{duration} · 识别中',
  loadingModel: '正在加载转谱模型…',
  songBusy: '本机仍在结束上一首歌，请稍后重新导入。',
  songSize: '歌曲模式支持 100 MB 以内的音频。',
  songServiceFailed: '本机歌曲服务不可用，请检查运行终端。',
  songDisconnected: '本机模型连接中断，请重新导入。',
  loadingSeparation: '正在加载人声分离模型，首次运行会下载模型…',
  separating: '正在分离人声、低音与鼓点 · {time}',
  trackingMelody: '正在追踪主旋律…',
  trackingBass: '正在提取低音伴奏…',
  songDuration: '歌曲模式支持 0.1 秒至 30 分钟的音频。',
  songProcessExited: '本地转谱进程退出，请查看运行终端。',
  inference: '正在识别音高、和弦与节奏…',
  noScore: '尚无曲谱',
  decodingFailed: '无法解码这个文件。请确认它是有效的 MP3、WAV 或其他浏览器支持的音频。',
  transcriptionFailed: '转谱失败，请重新导入重试。{reason}',
  demoFailed: '示例加载失败，请重试。',
  cancelledCount: '识别已取消',
  cancelled: '已取消转谱，可以重新导入音频。',
  samplesFailed: '钢琴音色加载失败，请刷新后重试。',
  audioTooShort: '这段音频太短了，请选择另一份文件。',
};

type Value = string | number | { key: MessageKey };
export type Params = Record<string, Value>;
export let locale: 'en' | 'zh' = 'en';
try { if (localStorage.getItem('echo-piano-language') === 'zh') locale = 'zh'; } catch { /* Storage may be unavailable. */ }

export function setLocale(value: string) {
  locale = value === 'zh' ? 'zh' : 'en';
  try { localStorage.setItem('echo-piano-language', locale); } catch { /* Keep the in-memory preference. */ }
}
export function isMessageKey(value: unknown): value is MessageKey {
  return typeof value === 'string' && Object.hasOwn(en, value);
}
export function t(key: MessageKey, params: Params = {}): string {
  return (locale === 'zh' ? zh[key] : en[key]).replace(/\{(\w+)\}/g, (placeholder, name) => {
    const value = params[name];
    return value === undefined ? placeholder : typeof value === 'object' ? t(value.key) : String(value);
  });
}
export function errorReason(error: unknown): Value {
  const reason = error instanceof Error ? error.message : String(error);
  return isMessageKey(reason) ? { key: reason } : reason;
}
export function setText(element: HTMLElement, key: MessageKey, params: Params = {}) {
  element.dataset.i18n = key;
  element.dataset.i18nParams = JSON.stringify(params);
  element.textContent = t(key, params);
}
export function setRawText(element: HTMLElement, text: string) {
  delete element.dataset.i18n;
  delete element.dataset.i18nParams;
  element.textContent = text;
}
export function setLabel(element: HTMLElement, key: MessageKey) {
  element.dataset.i18nLabel = key;
  element.setAttribute('aria-label', t(key));
}
export function applyTranslations() {
  document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', t('description'));
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach(element => {
    if (isMessageKey(element.dataset.i18n)) setText(element, element.dataset.i18n, JSON.parse(element.dataset.i18nParams ?? '{}'));
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-label]').forEach(element => {
    if (isMessageKey(element.dataset.i18nLabel)) setLabel(element, element.dataset.i18nLabel);
  });
}
