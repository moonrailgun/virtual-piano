"""Separate a song locally, then follow vocal and bass pitch instead of the full mix."""
import json
import os
import sys

os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')
import numpy as np
from scipy.ndimage import median_filter


def contour_notes(f0, confidence, rms, part):
    """Quantize stable pitch runs; keep rests and reject silent model hallucinations."""
    level = float(np.max(rms))
    if level < .001:
        return []
    pitches = np.rint(69 + 12 * np.log2(np.maximum(f0, 1) / 440)).astype(int)
    valid = (confidence >= .3) & (rms >= max(.003, level * .035)) & np.isfinite(f0)
    # ponytail: 130 ms smoothing favors sung melody; use onset-aware segmentation for fast ornaments.
    pitches = median_filter(pitches, size=13, mode='nearest')
    pitches[~valid] = 0
    edges = np.r_[0, np.flatnonzero(np.diff(pitches)) + 1, len(pitches)]
    # Bridge a <=30 ms unvoiced consonant only when the same pitch surrounds it.
    for start, end in zip(edges[:-1], edges[1:]):
        if pitches[start] == 0 and end - start <= 3 and start > 0 and end < len(pitches) and pitches[start - 1] == pitches[end]:
            pitches[start:end] = pitches[end]
    notes = []
    edges = np.r_[0, np.flatnonzero(np.diff(pitches)) + 1, len(pitches)]
    for start, end in zip(edges[:-1], edges[1:]):
        if 21 <= pitches[start] <= 108 and end - start >= 9:
            # Lead stays above the accompaniment in volume, at its original pitch.
            velocity = (.72 if part == 'melody' else .38) * (.8 + .2 * min(1, float(np.mean(rms[start:end])) / level))
            notes.append(dict(pitch=int(pitches[start]), start=round(start * .01, 3), end=round(end * .01, 3), velocity=round(velocity, 3), part=part))
    return notes


def emit(**event):
    print(json.dumps(event, ensure_ascii=False), flush=True)


def transcribe(path):
    import torch
    import torchcrepe
    import librosa
    from pathlib import Path
    from demucs.pretrained import get_model
    from demucs.apply import apply_model
    from demucs.separate import load_track

    torch.set_num_threads(min(4, os.cpu_count() or 1))
    device = 'cuda' if torch.cuda.is_available() else 'mps' if torch.backends.mps.is_available() else 'cpu'
    emit(type='progress', progress=.01, stage='loadingSeparation', label='Loading vocal separation model; the first run downloads weights…')
    model = get_model('htdemucs').eval()
    wav = load_track(Path(path), model.audio_channels, model.samplerate)
    duration = wav.shape[-1] / model.samplerate
    if not .1 <= duration <= 1800:
        emit(type='error', code='songDuration', message='Song mode supports audio from 0.1 seconds to 30 minutes.')
        return
    notes = []
    # Context on both sides protects phrase boundaries; only retain each core.
    for offset in range(0, int(np.ceil(duration)), 30):
        left, right = max(0, offset - 1), min(duration, offset + 31)
        chunk = wav[:, round(left * model.samplerate):round(right * model.samplerate)]
        mean, std = chunk.mean(), chunk.mean(0).std()
        if std < 1e-5:
            continue
        emit(type='progress', progress=.05 + .9 * offset / duration, stage='separating', time=f'{offset // 60}:{offset % 60:02d}', label='Separating vocals, bass, and drums…')
        sources = apply_model(model, ((chunk - mean) / std)[None], device=device, shifts=0, progress=False)[0] * std
        for index, (source, part, low, high) in enumerate([('vocals', 'melody', 65, 1100), ('bass', 'bass', 32.7, 350)]):
            emit(type='progress', progress=min(.98, .05 + .9 * (offset + 10 + 10 * index) / duration), stage='trackingMelody' if part == 'melody' else 'trackingBass', label='Tracking main melody…' if part == 'melody' else 'Extracting bass accompaniment…')
            samples = librosa.resample(sources[model.sources.index(source)].mean(0).numpy(), orig_sr=model.samplerate, target_sr=16000)
            rms = librosa.feature.rms(y=samples, frame_length=1024, hop_length=160)[0]
            if np.max(rms) < .001:
                continue
            pitch, confidence = torchcrepe.predict(torch.from_numpy(samples)[None], 16000, 160, low, high, 'full', batch_size=512 if device != 'cpu' else 128, device=device, return_periodicity=True)
            for note in contour_notes(pitch.cpu().numpy()[0], confidence.cpu().numpy()[0], rms, part):
                start, end = left + note['start'], min(duration, left + note['end'])
                if end > offset and start < offset + 30:
                    notes.append({**note, 'start': max(offset, start), 'end': min(offset + 30, end)})
    # Merge only contiguous copies of the same note at processing boundaries.
    result = []
    last = {}
    for note in sorted(notes, key=lambda n: n['start']):
        key = (note['part'], note['pitch'])
        previous = last.get(key)
        if previous and abs(previous['end'] - note['start']) < .001:
            previous['end'] = note['end']
        else:
            result.append(note)
            last[key] = note
    emit(type='complete', notes=result, duration=duration)


if __name__ == '__main__':
    try:
        transcribe(sys.argv[1])
    except Exception as error:
        import traceback
        traceback.print_exc(file=sys.stderr)
        emit(type='error', message=str(error))
        sys.exit(1)
