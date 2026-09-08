export interface Note { pitch: number; start: number; end: number; velocity: number; part?: 'melody' | 'bass' }

export function noteName(midi: number): string {
  return `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;
}

export const numberedRows = ['qweruiop', 'asdfjkl;', 'zxcvm,./'];

export function keyboardMapping(mode: 'piano' | 'numbered', tonic: number): Record<string, number> {
  if (mode === 'piano') return { a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66, g: 67, y: 68, h: 69, u: 70, j: 71, k: 72, o: 73, l: 74, p: 75, ';': 76 };
  const scale = [0, 2, 4, 5, 7, 9, 11, 12];
  return Object.fromEntries(numberedRows.flatMap((row, octave) =>
    [...row].map((key, degree) => [key, 72 + tonic - octave * 12 + scale[degree]])
  ));
}

export function numberedNote(pitch: number, tonic: number): { degree: string; octave: number } {
  const relative = pitch - (60 + tonic);
  return {
    degree: ['1', '♯1', '2', '♯2', '3', '4', '♯4', '5', '♯5', '6', '♯6', '7'][(relative % 12 + 12) % 12],
    octave: Math.floor(relative / 12),
  };
}

export function pianoKeys() {
  let white = 0;
  return Array.from({ length: 88 }, (_, i) => {
    const midi = i + 21;
    const black = [1, 3, 6, 8, 10].includes(midi % 12);
    const key = { midi, black, left: black ? white - .31 : white, width: black ? .62 : 1 };
    if (!black) white++;
    return key;
  });
}

export function mergeNotes(notes: Note[]): Note[] {
  const merged: Note[] = [];
  const last = new Map<number, Note>();
  for (const note of notes.filter(n => n.pitch >= 21 && n.pitch <= 108 && n.end > n.start).sort((a, b) => a.start - b.start)) {
    const previous = last.get(note.pitch);
    if (previous && previous.end > note.start) {
      previous.end = Math.max(previous.end, note.end);
      previous.velocity = Math.max(previous.velocity, note.velocity);
    } else {
      const copy = { ...note };
      merged.push(copy);
      last.set(copy.pitch, copy);
    }
  }
  return merged;
}

export function visibleNotes(notes: Note[], time: number, horizon: number): Note[] {
  return notes.filter(n => n.end >= time && n.start <= time + horizon);
}

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
}
