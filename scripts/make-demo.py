"""Render our original demo and its expected notes. Requires ffmpeg on PATH."""
import array
import json
import math
import subprocess
from pathlib import Path

RATE = 22050
notes = []
melody = [64, 67, 71, 67, 62, 66, 69, 66, 60, 64, 67, 72, 62, 67, 71, 69,
          64, 67, 72, 71, 62, 66, 69, 74, 60, 64, 67, 76, 71, 67, 64, 60]
for i, pitch in enumerate(melody):
    notes.append(dict(pitch=pitch, start=.4 + i * .625, end=.4 + i * .625 + .5, velocity=.75))
for bar, chord in enumerate([[48, 55], [50, 57], [45, 52], [43, 55], [48, 55], [50, 57], [45, 52], [48, 55]]):
    for pitch in chord:
        notes.append(dict(pitch=pitch, start=.4 + bar * 2.5, end=.4 + bar * 2.5 + 1.8, velocity=.55))
notes += [dict(pitch=pitch, start=20.4, end=22.4, velocity=.65) for pitch in [48, 55, 60, 64, 67]]
notes.sort(key=lambda n: n['start'])
samples = {}
for octave in range(1, 9):
    raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', f'public/piano/C{octave}.mp3', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-'])
    samples[(octave + 1) * 12] = array.array('f', raw)
output = array.array('f', [0]) * (24 * RATE)
for note in notes:
    root = min(samples, key=lambda pitch: abs(pitch - note['pitch']))
    sample = samples[root]
    speed = 2 ** ((note['pitch'] - root) / 12)
    start = round(note['start'] * RATE)
    duration = note['end'] - note['start']
    for i in range(round((duration + .45) * RATE)):
        cursor = i * speed
        index = int(cursor)
        if index + 1 >= len(sample) or start + i >= len(output):
            break
        value = sample[index] + (sample[index + 1] - sample[index]) * (cursor - index)
        release = math.exp(-max(0, i / RATE - duration) / .09)
        output[start + i] += value * release * note['velocity']
peak = max(abs(value) for value in output)
output = array.array('f', (value * .85 / peak for value in output))
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(RATE), '-ac', '1', '-i', '-', '-codec:a', 'libmp3lame', '-q:a', '3', 'public/demo.mp3'], input=output.tobytes(), check=True)
Path('tests/demo-notes.json').write_text(json.dumps(notes, indent=2) + '\n')
print(f'Rendered demo.mp3: 24 seconds, {len(notes)} notes')
