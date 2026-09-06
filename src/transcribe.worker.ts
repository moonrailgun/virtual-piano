import * as tf from '@tensorflow/tfjs';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';
import { BasicPitch, noteFramesToTime, outputToNotesPoly } from '@spotify/basic-pitch';
import { mergeNotes, type Note } from './music';

self.onmessage = async ({ data }: MessageEvent<{ samples: Float32Array; base: string }>) => {
  try {
    setWasmPaths(`${data.base}wasm/`);
    await tf.setBackend('wasm');
    await tf.ready();
    const model = new BasicPitch(`${data.base}model/model.json`);
    await model.model;
    const notes: Note[] = [];
    const sampleRate = 22050;
    const duration = data.samples.length / sampleRate;
    // Keep inference memory bounded; overlap protects notes at each chunk boundary.
    for (let offset = 0; offset < duration; offset += 18) {
      const chunkStart = Math.max(0, offset - 1);
      const chunkEnd = Math.min(duration, offset + 19);
      const frames: number[][] = [];
      const onsets: number[][] = [];
      tf.engine().startScope();
      try {
        await model.evaluateModel(
          data.samples.subarray(Math.round(chunkStart * sampleRate), Math.round(chunkEnd * sampleRate)),
          (f, o) => { frames.push(...f); onsets.push(...o); },
          progress => self.postMessage({ type: 'progress', progress: Math.min(.99, (offset + progress * 18) / duration) }),
        );
        for (const note of noteFramesToTime(outputToNotesPoly(frames, onsets, .5, .3, 11))) {
          const start = chunkStart + note.startTimeSeconds;
          const end = Math.min(duration, start + note.durationSeconds);
          if (end > offset && start < offset + 18) {
            notes.push({ pitch: note.pitchMidi, start: Math.max(offset, start), end, velocity: note.amplitude });
          }
        }
      } finally {
        tf.engine().endScope();
      }
    }
    self.postMessage({ type: 'complete', notes: mergeNotes(notes) });
  } catch (error) {
    console.error(error);
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
  }
};
