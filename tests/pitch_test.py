"""Run with .venv/bin/python tests/pitch_test.py."""
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'server'))
import numpy as np
from transcribe import accompaniment_samples, contour_notes

# Keep bass and chord tones, even with reordered stems; discard vocals and drums.
sources = np.zeros((4, 2, 44100))
names = ['other', 'vocals', 'drums', 'bass']
time = np.arange(44100) / 44100
for source, frequencies in zip(sources, ([440, 550, 660], [1000], [1500], [110])):
    source[:] = sum(.1 * np.sin(2 * np.pi * frequency * time) for frequency in frequencies)
samples = accompaniment_samples(sources, names, 44100)
assert samples.shape == (22050,)
spectrum = abs(np.fft.rfft(samples))
assert min(spectrum[[110, 440, 550, 660]]) > 1000
assert max(spectrum[[1000, 1500]]) < 1
assert np.all(accompaniment_samples(np.zeros_like(sources), names, 44100) == 0)

# A stable note, a brief confidence dropout, a real rest, a new note and silence.
f0 = np.r_[np.full(30, 440.), np.full(20, 493.88), np.full(20, 440.)]
confidence = np.ones(70)
confidence[12:15] = 0
confidence[26:30] = 0
rms = np.r_[np.ones(50), np.zeros(20)]
notes = contour_notes(f0, confidence, rms, 'melody')
assert [n['pitch'] for n in notes] == [69, 71], notes
assert notes[0]['start'] == 0 and .24 <= notes[0]['end'] <= .27, notes
assert notes[1]['start'] == .3 and notes[1]['end'] == .5, notes
assert contour_notes(f0, confidence, np.zeros(70), 'melody') == []
assert all(0 < n['velocity'] <= 1 and n['end'] > n['start'] for n in notes)
# Brief semitone wobble in a sustained vocal must not leave holes in the melody.
vibrato = np.full(90, 440.)
for start in range(10, 80, 10):
    vibrato[start:start + 3] *= 2 ** (1 / 12)
steady = contour_notes(vibrato, np.ones(90), np.ones(90), 'melody')
assert len(steady) == 1 and steady[0]['pitch'] == 69 and steady[0]['end'] == .9, steady
print('Pitch segmentation: dropout, rest, pitch change, vocal wobble and silence passed')
