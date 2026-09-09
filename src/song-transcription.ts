import type { Note } from './music';

type SongAudio = Pick<AudioBuffer, 'sampleRate' | 'length' | 'numberOfChannels' | 'getChannelData'>;
type Progress = { progress: number; stage?: string; time: string };

function encodeWav(audio: SongAudio, start: number, end: number) {
  const channels = Math.min(2, audio.numberOfChannels);
  const first = Math.round(start * audio.sampleRate);
  const frames = Math.min(audio.length, Math.round(end * audio.sampleRate)) - first;
  const buffer = new ArrayBuffer(44 + frames * channels * 2);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => [...value].forEach((letter, i) => view.setUint8(offset + i, letter.charCodeAt(0)));
  text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true);
  text(8, 'WAVEfmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, channels, true);
  view.setUint32(24, audio.sampleRate, true); view.setUint32(28, audio.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true); view.setUint16(34, 16, true);
  text(36, 'data'); view.setUint32(40, buffer.byteLength - 44, true);
  for (let channel = 0; channel < channels; channel++) {
    const samples = audio.getChannelData(channel);
    for (let frame = 0; frame < frames; frame++) {
      const sample = Math.max(-1, Math.min(1, samples[first + frame]));
      view.setInt16(44 + (frame * channels + channel) * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

export async function transcribeSong(audio: SongAudio, signal: AbortSignal, onProgress: (data: Progress) => void): Promise<Note[]> {
  const duration = audio.length / audio.sampleRate;
  if (!Number.isFinite(duration) || duration < .1 || duration > 1800) throw new Error('songDuration');
  const result: Note[] = [];
  const last = new Map<string, Note>();
  // Short chunks leave CPU inference time within the function deadline, including context.
  for (let offset = 0; offset < duration; offset += 5) {
    signal.throwIfAborted();
    const left = Math.max(0, offset - 1), end = Math.min(duration, offset + 5);
    const response = await fetch('/api/transcribe', { method: 'POST', body: encodeWav(audio, left, Math.min(duration, end + 1)), signal });
    if (!response.ok || !response.body) throw new Error(response.status === 409 ? 'songBusy' : response.status === 413 ? 'songSize' : 'songServiceFailed');
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = '', completed = false;
    try {
      while (!completed) {
        const { value, done } = await reader.read();
        signal.throwIfAborted();
        if (done) throw new Error('songDisconnected');
        pending += value;
        const lines = pending.split('\n');
        pending = lines.pop()!;
        for (const line of lines) {
          if (!line.trim()) continue;
          const data = JSON.parse(line);
          if (data.type === 'error') throw new Error(data.code || data.message || 'songServiceFailed');
          if (data.type === 'complete') {
            for (const note of data.notes as Note[]) {
              const start = Math.max(offset, left + note.start), stop = Math.min(end, left + note.end);
              if (stop <= start) continue;
              const key = `${note.part}:${note.pitch}`, previous = last.get(key);
              if (previous && Math.abs(previous.end - offset) < .001 && Math.abs(start - offset) < .001) previous.end = stop;
              else {
                const next = { ...note, start, end: stop };
                result.push(next);
                last.set(key, next);
              }
            }
            completed = true;
            break;
          }
          onProgress({ progress: (offset + Math.max(0, Math.min(1, data.progress ?? 0)) * (end - offset)) / duration, stage: data.stage, time: `${Math.floor(offset / 60)}:${String(offset % 60).padStart(2, '0')}` });
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
  }
  return result.sort((a, b) => a.start - b.start);
}
