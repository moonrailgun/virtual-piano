export interface Note { pitch: number; start: number; end: number; velocity: number; part?: 'melody' | 'bass' }

export function noteName(midi: number): string {
  return `${['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'][midi % 12]}${Math.floor(midi / 12) - 1}`;
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
