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

Paste a public audio or video URL into **Import from an audio or video link**. Audio file links (MP3, WAV, M4A, OGG, FLAC, AAC, Opus, AIFF) load directly when the browser permits it; blocked links and URLs without an audio extension use the server. The server uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) for YouTube and other supported sites, with a dedicated Bilibili resolver (`?p=2` selects a part). It downloads all audio, converts it to M4A, and checks the decoded duration before returning the file for transcription. Incomplete previews, missing fragments, live streams, and videos without a known duration are rejected. Imports are limited to 20 minutes / 100 MB with a 280-second processing deadline; cancellation stops the download and removes temporary files. Login, paid access, region restrictions, unsupported sites, and anti-bot checks can prevent imports. No personal browser cookies are read.

Open `/?importUrl=<encoded source URL>` to import automatically on page load, without autoplay. Build the query with `new URLSearchParams({ importUrl: sourceUrl })` so source parameters such as `?p=2&...` stay intact. Example: `/?importUrl=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DjNQXAC9IVRw`. Direct audio files without duration metadata are checked after decoding.

Switch **Play mode → Numbered score**, then **Show key map** to open a floating diagram of the physical keyboard without moving the score. The three rows are **QWER · UIOP** (high), **ASDF · JKL;** (middle), and **ZXCV · M,./** (low). Each row splits four keys per hand and plays 1–7 plus the next octave’s 1. The diagram follows the selected key and can be collapsed. Hold **Shift** to raise newly pressed notes by a semitone (Shift+A plays middle ♯1); held notes keep their pitch, so you can hold natural notes before adding shifted notes to a chord. Choose any of the 12 major keys; in C major, A plays C4, while in D major it plays D4 and D plays F♯4. The falling notes and piano keys show degrees, octave dots, and chromatic accidentals. The mode and key are saved in this browser. Changing them releases held manual notes and updates shortcuts and labels; imported pitches, playback, and MIDI exports stay unchanged. This is a numbered falling-note view, not engraved rhythmic notation.

```sh
npm test
npm run test:audio
npm run build
npm run preview
```

During local development, song mode sends audio through Vite to the Python service at `127.0.0.1:8001`. In production, it uploads audio chunks to the same-origin Vercel Python function; temporary files are deleted after completion or cancellation. Instrument transcription runs in the browser. The Chinese serif font may load from Google Fonts, with system fonts as a fallback.

## Deploy to Vercel

Import [moonrailgun/virtual-piano](https://github.com/moonrailgun/virtual-piano) into Vercel. `vercel.json` configures the Vite build and model asset copying. The same deployment includes the Python song function and the Node.js video import function; visitors need no local Python installation.

`api/video.mjs` runs as a Node.js 24 function with a 300-second timeout; Vite dev/preview uses the same handler. `npm install` downloads a pinned, SHA-256-verified standalone yt-dlp binary (including Python and the YouTube EJS solver) and installs `ffmpeg-static`. macOS and Linux are supported; `npm run setup:video` restores the downloader. Vercel includes both binaries in the function bundle. The server checks full audio before streaming the resulting M4A response to the browser, which sends songs to the song service or transcribes instrument recordings itself. Download requests use a local proxy that blocks private/reserved destinations, pins DNS results, and checks redirect destinations. Serving only `dist/` does not include this API. YouTube and Bilibili may block datacenter IPs, so verify the deployed preview separately.

### Song function

`api/transcribe.py` uses Python 3.12 and CPU PyTorch from the root `requirements.txt`. Enable Fluid Compute for the Vercel project. `vercel.json` opts into large Python functions with `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` during builds and sets a 300-second timeout. Also set `VERCEL_SUPPORT_LARGE_FUNCTIONS=1` in the project's Production and Preview environment variables so production promotion and Git builds use the same limit. See [Vercel function limits](https://vercel.com/docs/functions/limitations).

The browser decodes the song to stereo 44.1 kHz, then uploads sequential 5-second PCM16 WAV chunks with one second of context on each side (at most 1.24 MB per request). Each function call uses a 4-second Demucs window to stay within 2 GB of memory, tracks vocal and bass pitch, and streams NDJSON progress. The browser trims overlap and joins boundary notes on the original timeline. This fits the 4.5 MB request limit without external storage or another server. Each call has a 270-second processing deadline; one invocation per process runs inference at a time. Cancellation stops subsequent chunks and closes the active request.

Demucs weights download on the first transcription and use the instance's `/tmp` cache. Uploaded chunks are deleted after processing or disconnect. `/api/health` routes to the same Python function and checks handler availability; it does not warm or verify the models. Check a real song on the deployed preview before promoting it. Instrument mode runs in the browser.

Run `python3 tests/song_service_test.py` to check routing, request limits, and origin isolation without installing models. `npm test` also checks chunk size, overlap merging, stream interruption, and cancellation.

## How transcription works

- **Song mode:** [Demucs](https://github.com/facebookresearch/demucs) separates vocals, bass, drums, and other accompaniment. [CREPE](https://github.com/maxrmorrison/torchcrepe) then tracks vocal and bass pitch. Pitch contours undergo jitter filtering, rest detection, and note segmentation before export as separate melody and bass MIDI tracks. Audio is processed in 5-second chunks with context on both sides. Apple MPS or CUDA is used when available, otherwise CPU. CPU inference can take substantially longer than the playback duration of a full song. One song is processed at a time; cancellation is supported. Song duration is limited to 30 minutes.
- **Instrument mode:** Web Audio decodes audio into 22,050 Hz mono. [Spotify Basic Pitch](https://github.com/spotify/basic-pitch-ts) runs in a Web Worker using TensorFlow.js WASM to detect polyphonic pitches, note timing, and velocity. Inference runs in overlapping chunks.

Song mode creates a simplified piano arrangement of the lead vocal melody and bass. It **does not reconstruct full chords, orchestration, or fingering**. Intros and instrumental passages may be sparse; slides, backing vocals, and fast ornaments may be inaccurate. Instrument mode can mistake overtones and accompaniment for the melody in a full song mix. Both modes produce an initial transcription for editing: a piano roll and MIDI with timing in seconds, rather than engraved sheet music. Original playback uses the imported file; piano playback uses bundled piano samples.

Basic Pitch's older TensorFlow.js 3.x WASM `Fill` kernel cannot handle an omitted dtype during padding. Dependencies therefore use the fixed 4.22.0 release, with an override to prevent loading two TensorFlow versions.

## Browser verification

`npm test` checks piano key geometry, chunk merging, seek visibility, all 12 major-key mappings, octave labels, and translation consistency. Browser checks use Orca without adding a test dependency. Open the preview URL in an Orca browser tab (a fresh development server may reload while optimizing model dependencies), then run:

```sh
npm run test:browser -- <browser-page-id>
npm run test:song -- <browser-page-id> '<local-song-path>'
```

The browser check covers English defaults, language switching and persistence, translated errors, and switching languages during playback without losing state. It imports `public/demo.mp3`, compares the exported MIDI against 53 reference notes in `tests/demo-notes.json`, and checks transcription across chunks, piano audio output, playback, pause, seeking, original audio, cancellation, corrupt files, and silence. It also checks demo download failures and cancellation, then transcribes and plays the full Moonlight first movement and Für Elise. It reloads the specified test page.

Numbered-mode checks cover transposed audio, black-key shortcuts, octave dots, held-note release when changing key, input focus, saved preferences, and unchanged MIDI and playback.

`test:song` uploads the specified song through the browser and checks that cancellation stops the model process, re-importing works, transcription completes, both monophonic tracks are present, and piano playback produces an audio signal. It verifies the processing flow. Musical fidelity still needs listening comparison with the original; note counts and a nonzero signal cannot establish it.

## Demo pieces

Choose a piece beside the upload button, then click **Try a demo**. Demos use the same instrument transcription, piano playback, original audio comparison, and MIDI export as imported files.

- **After the Rain:** a short original test melody. Regenerate it with `python3 scripts/make-demo.py` (requires FFmpeg).
- **Moonlight Sonata · I — Beethoven:** the full first movement (about 5:07), from a public-domain Mutopia MIDI rendering. The longer piece takes more time to transcribe. See [audio sources and licensing](public/demos/README.md).
- **Für Elise — Beethoven:** a complete piano performance by V. Gao (about 2:57), released under CC0. See [audio sources and licensing](public/demos/README.md).

## Credits

- Interaction reference: [Brandenburg Piano](https://brandenburg-piano.vercel.app/).
- Transcription model: [Spotify Basic Pitch](https://github.com/spotify/basic-pitch-ts), Apache-2.0.
- Song separation: [Demucs](https://github.com/facebookresearch/demucs), MIT. Pitch tracking: [torchcrepe](https://github.com/maxrmorrison/torchcrepe), MIT.
- Piano samples: Alexander Holm's Salamander Grand Piano, CC BY 3.0. See [public/piano/README.txt](public/piano/README.txt) for provenance and license details.
