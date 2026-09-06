# Echo Piano

**English** | [简体中文](README.zh-CN.md)

Drop an MP3 into your browser and turn it into an 88-key piano roll. Watch falling notes and highlighted keys, play the piano arrangement, compare it with the original audio, seek, change playback speed, play manually, and export MIDI.

[Try Echo Piano](https://virtual-piano-sable.vercel.app)

The interface defaults to English. Switch between English and Simplified Chinese in the header; your choice is saved in the current browser. Switching languages preserves the score and playback state. Project documentation and development content use English first. Both UI dictionaries live in `src/i18n.ts`.

## Run locally

Requires Node.js 22.18+ (developed with Node.js 24).

```sh
npm install
npm run setup:audio
npm run dev
```

Song mode also requires [uv](https://docs.astral.sh/uv/getting-started/installation/) and FFmpeg. `setup:audio` creates a project-local Python 3.11 environment and installs model dependencies. The first transcription downloads Demucs weights; later runs use the local cache. `npm run dev` and `npm run preview` start the local model service automatically. No API key is needed.

Open the local URL printed in the terminal. Choose **Song · Melody + bass** and import a song. For clear piano, guitar, or other instrument recordings, choose **Instrument · Polyphonic**; this mode needs no Python setup and is also used by the demo. Click the keys, or use A–L and the neighboring black-key shortcuts to play. Press Space to play or pause.

```sh
npm test
npm run test:audio
npm run build
npm run preview
```

Song mode sends audio to the local Python service at `127.0.0.1:8001`. Temporary files are deleted after completion or cancellation; audio is never sent to an external service. Static deployments of `dist/` support instrument mode. Song mode also needs the local service and the `/api` proxy. The Chinese serif font may load from Google Fonts, with system fonts as a fallback.

## Deploy to Vercel

Import [moonrailgun/virtual-piano](https://github.com/moonrailgun/virtual-piano) into Vercel. `vercel.json` configures the Vite build, model asset copying, and browser transcription mode.

The public version supports audio import, polyphonic instrument transcription, piano playback, original audio comparison, and MIDI export. Audio is processed in the visitor's browser. Enhanced song mode is disabled on the public site; the Python/PyTorch service remains a local feature and is not included in the static deployment. Hosting enhanced song mode requires a separate model server rather than a Vercel function.

## How transcription works

- **Song mode:** [Demucs](https://github.com/facebookresearch/demucs) separates vocals, bass, drums, and other accompaniment. [CREPE](https://github.com/maxrmorrison/torchcrepe) then tracks vocal and bass pitch. Pitch contours undergo jitter filtering, rest detection, and note segmentation before export as separate melody and bass MIDI tracks. Audio is processed in 30-second chunks with context on both sides. Apple MPS or CUDA is used when available, otherwise CPU. A full song may take several minutes, longer on CPU. One song is processed at a time; cancellation is supported. Input is limited to 100 MB and 30 minutes.
- **Instrument mode:** Web Audio decodes audio into 22,050 Hz mono. [Spotify Basic Pitch](https://github.com/spotify/basic-pitch-ts) runs in a Web Worker using TensorFlow.js WASM to detect polyphonic pitches, note timing, and velocity. Inference runs in overlapping chunks.

Song mode creates a simplified piano arrangement of the lead vocal melody and bass. It **does not reconstruct full chords, orchestration, or fingering**. Intros and instrumental passages may be sparse; slides, backing vocals, and fast ornaments may be inaccurate. Instrument mode can mistake overtones and accompaniment for the melody in a full song mix. Both modes produce an initial transcription for editing: a piano roll and MIDI with timing in seconds, rather than engraved sheet music. Original playback uses the imported file; piano playback uses bundled piano samples.

Basic Pitch's older TensorFlow.js 3.x WASM `Fill` kernel cannot handle an omitted dtype during padding. Dependencies therefore use the fixed 4.22.0 release, with an override to prevent loading two TensorFlow versions.

## Browser verification

`npm test` checks piano key geometry, chunk merging, seek visibility, and translation consistency. Browser checks use Orca without adding a test dependency. Open the development or preview URL in an Orca browser tab, then run:

```sh
npm run test:browser -- <browser-page-id>
npm run test:song -- <browser-page-id> '<local-song-path>'
```

The browser check covers English defaults, language switching and persistence, translated errors, and switching languages during playback without losing state. It imports `public/demo.mp3`, compares the exported MIDI against 53 reference notes in `tests/demo-notes.json`, and checks transcription across chunks, piano audio output, playback, pause, seeking, original audio, cancellation, corrupt files, and silence. It reloads the specified test page.

`test:song` uploads the specified song through the browser and checks that cancellation stops the model process, re-importing works, transcription completes, both monophonic tracks are present, and piano playback produces an audio signal. It verifies the processing flow. Musical fidelity still needs listening comparison with the original; note counts and a nonzero signal cannot establish it.

The demo is an original test melody. Regenerate it with `python3 scripts/make-demo.py` (requires FFmpeg).

## Credits

- Interaction reference: [Brandenburg Piano](https://brandenburg-piano.vercel.app/).
- Transcription model: [Spotify Basic Pitch](https://github.com/spotify/basic-pitch-ts), Apache-2.0.
- Song separation: [Demucs](https://github.com/facebookresearch/demucs), MIT. Pitch tracking: [torchcrepe](https://github.com/maxrmorrison/torchcrepe), MIT.
- Piano samples: Alexander Holm's Salamander Grand Piano, CC BY 3.0. See [public/piano/README.txt](public/piano/README.txt) for provenance and license details.
