import type { Note } from './music';

export class PianoAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private samples = new Map<number, AudioBuffer>();
  private loading?: Promise<void>;
  private voices = new Set<() => void>();
  private timer = 0;
  private generation = 0;
  private anchor = 0;
  private position = 0;
  private speed = 1;
  private mode: 'piano' | 'original' = 'piano';
  readonly original = Object.assign(new Audio(), { volume: .65 });
  playing = false;

  get context(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = .65;
      const limiter = this.ctx.createDynamicsCompressor();
      this.master.connect(limiter).connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async ready() {
    const ctx = this.context;
    await ctx.resume();
    if (!this.loading) {
      this.loading = Promise.all(Array.from({ length: 8 }, async (_, i) => {
        const response = await fetch(`${import.meta.env.BASE_URL}piano/C${i + 1}.mp3`);
        if (!response.ok) throw new Error('钢琴音色加载失败，请刷新后重试。');
        this.samples.set((i + 2) * 12, await ctx.decodeAudioData(await response.arrayBuffer()));
      })).then(() => {}).catch(error => { this.loading = undefined; throw error; });
    }
    await this.loading;
  }

  setVolume(volume: number) {
    this.context;
    this.master!.gain.setTargetAtTime(volume, this.context.currentTime, .02);
    this.original.volume = volume;
  }

  strike(pitch: number, duration = 8, velocity = .8, delay = 0): () => void {
    const ctx = this.context;
    const root = Math.max(24, Math.min(108, Math.round(pitch / 12) * 12));
    const buffer = this.samples.get(root);
    if (!buffer) return () => {};
    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = 2 ** ((pitch - root) / 12);
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(Math.max(.05, Math.min(1, velocity)), start);
    gain.gain.setTargetAtTime(.0001, start + duration, .09);
    source.connect(gain).connect(this.master!);
    source.start(start);
    source.stop(start + duration + .6);
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setTargetAtTime(.0001, ctx.currentTime, .025);
      source.stop(ctx.currentTime + .15);
      this.voices.delete(stop);
    };
    this.voices.add(stop);
    source.onended = () => { this.voices.delete(stop); source.disconnect(); gain.disconnect(); };
    return stop;
  }

  get time() {
    if (!this.playing) return this.position;
    return this.mode === 'original' ? this.original.currentTime : this.position + (this.context.currentTime - this.anchor) * this.speed;
  }

  async play(notes: Note[], position: number, speed: number, mode: 'piano' | 'original') {
    this.pause();
    const generation = this.generation;
    if (mode === 'piano') await this.ready();
    else await this.context.resume();
    if (generation !== this.generation) return;
    this.position = position;
    this.speed = speed;
    this.mode = mode;
    if (mode === 'original') {
      this.original.currentTime = position;
      this.original.playbackRate = speed;
      this.original.preservesPitch = true;
      await this.original.play();
      if (generation !== this.generation) return;
    }
    this.anchor = this.context.currentTime;
    this.playing = true;
    if (mode === 'piano') {
      let index = notes.findIndex(note => note.end > position);
      if (index === -1) return;
      const schedule = () => {
        const now = this.time;
        while (index < notes.length && notes[index].start < now + .12 * speed) {
          const note = notes[index++];
          if (note.end > now) this.strike(note.pitch, (note.end - Math.max(now, note.start)) / speed, note.velocity, Math.max(0, (note.start - now) / speed));
        }
      };
      schedule();
      this.timer = window.setInterval(schedule, 25);
    }
  }

  pause() {
    this.position = this.time;
    this.playing = false;
    this.generation++;
    clearInterval(this.timer);
    this.original.pause();
    for (const stop of this.voices) stop();
  }
}

export async function decodeAudio(file: File, context: AudioContext) {
  const decoded = await context.decodeAudioData(await file.arrayBuffer());
  if (!Number.isFinite(decoded.duration) || decoded.duration < .1) throw new Error('这段音频太短了，请选择另一份文件。');
  const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * 22050), 22050);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const mono = await offline.startRendering();
  return { duration: decoded.duration, samples: mono.getChannelData(0) };
}
