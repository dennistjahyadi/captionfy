# Captionfy

Offline, on-device auto-captions for short vertical video. No account, no upload,
no server. One React Native codebase for Android and iOS.

**Status: Phase 0.** Nothing here is the product yet. The only thing being built is
the Stage 0 accuracy spike that decides whether on-device transcription is good
enough on messy creator audio.

## Layout

```
app/                     Expo Router screens. During Phase 0 the one route hosts Rig A.
src/domain/              Pure TypeScript, no react-native imports, unit tested.
modules/audio-extract/   Expo module: video -> 16 kHz mono s16le PCM. The only audio path.
modules/spike-metrics/   Throwaway Phase 0 probes. Delete with spike/.
spike/rn-whisper/        Rig A. Throwaway. Not shipped.
```

## Phase 0 — Stage 0 accuracy spike

### What Rig A does

Pick a video, decode its audio once, run every candidate model over those exact
bytes, write one CSV row per model.

Per clip: `extract -> VAD -> transcribe each speech span -> merge tokens into words`.
Every span is transcribed on its own, so word timestamps come back relative to the
span and get shifted onto the clip timeline.

### Models

The brief asks for q5_0. `ggerganov/whisper.cpp` publishes no q5_0 build; its only
5-bit quantisations are q5_1. The rig uses q5_1, which is the same 5-bit weight
budget with a per-block minimum instead of a symmetric scale, so it is slightly
larger and slightly more accurate. The exact filename is recorded in every CSV row.

| Model in the rig | File | Approx. size | Role |
| --- | --- | --- | --- |
| `base.en-q8_0` | `ggml-base.en-q8_0.bin` | 82 MB | Low-end fallback candidate |
| `small.en-q5_1` | `ggml-small.en-q5_1.bin` | 190 MB | English-only ceiling, comparison only |
| `small-q5_1` | `ggml-small-q5_1.bin` | 190 MB | The candidate the pass/fail gate is about |
| Silero VAD | `ggml-silero-v6.2.0.bin` | 3 MB | Gates every transcription |

Models download to the app document directory on first use. None is bundled.

### Pass/fail

The rig produces numbers; word error rate is hand-counted from the `transcript`
column. The gate from the brief:

- Multilingual `small` under 10% WER on `clean-accented` **and** under 15% on
  `music-under-voice` means proceed to Phase 1 with whisper.rn.
- Music clips over 25% WER means stop and report.
- Over 45 s or an out-of-memory for a 60 s clip on the slowest target phone means
  ship `base` as the default with `small` opt-in. The CSV's `seconds_per_60s`
  column is that number directly.
- Word timestamps drifting past roughly 200 ms under music is a flag for a possible
  forced-alignment pass. `rig-a-words.jsonl` carries every word boundary.

### Running it

Measurements only count in a release build on a physical arm64 device. A debug
build is 10 to 20 times slower and the screen says so in red.

Plug the phone in, with USB debugging turned on, and run:

```bash
npm install
./install-on-phone.sh          # build, install, launch. --logs also tails the pipeline
```

The script finds the SDK, picks the handset over any running emulator, builds only
that phone's architecture, and explains what to do when no device is found or the
signature does not match. `--fresh` wipes app data, which means downloading the
models again. `--skip-build` installs the APK that is already built.

The long way, if you want the steps separately:

```bash
npx expo prebuild --platform android
cd android && ./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

whisper.rn compiles an `armv8.2-a+fp16` variant of whisper.cpp alongside a generic
one and selects at runtime, so the NEON and fp16 paths need no extra flags.

### Working on the UI

The release APK bakes the JS bundle in, so every screen tweak costs a full rebuild
and reinstall. For UI work use the debug build instead, which pulls JS from Metro:

```bash
./install-on-phone.sh --dev    # or: npm run dev
```

That builds once, installs, and leaves Metro running. Save a change to
`spike/rn-whisper/` or `app/` and the phone redraws in about a second. Only native
changes need the command again: anything under `modules/`, the plugin list in
`app.json`, or a new dependency with native code.

Both variants are signed with the same debug keystore and share a package name, so
switching between `--dev` and the release install keeps the 465 MB of downloaded
models in place. No `--fresh` needed.

The banner reads `DEBUG BUILD` in red the whole time. That is the point: nothing
measured in this mode is reportable. Re-run `./install-on-phone.sh` for numbers.

### Architectures

`app.json` sets `buildArchs` to `arm64-v8a, x86_64`, which is what `expo-build-properties`
writes into `android/gradle.properties` on prebuild. That is the file's only home,
because `/android` is generated and gitignored, so hand-edits there vanish on the
next prebuild.

Both entries are 64-bit. Play Store has required 64-bit since 2019, `minSdkVersion`
is 26, and dropping `armeabi-v7a` and `x86` halves a whisper.cpp compile that
dominates build time. `arm64-v8a` covers every real handset and every emulator image
on an Apple Silicon Mac; `x86_64` is kept only so an Intel machine or a cloud CI
emulator can still build.

Neither build path pays for both. `install-on-phone.sh` narrows to the plugged-in
phone's own ABI, passing `-PreactNativeArchitectures` to Gradle for the release
build and `ORG_GRADLE_PROJECT_reactNativeArchitectures` for `--dev`, since
`expo run:android` has no flag for it.

Watch the pipeline:

```bash
adb logcat -s RNWhisper:* Caption:*
```

Every CSV row is mirrored to the `Caption` tag as `CSV_ROW ...`, because release
builds cannot be read with `adb run-as` and JS `console.log` is not dependable once
the bundle is minified. The rig also writes the files below and has a Share button.

```
<app documents>/spike-results/rig-a.csv          one row per (clip, model)
<app documents>/spike-results/rig-a-words.jsonl  word-level timings per run
```

### Reading the CSV

Columns worth knowing:

| Column | Why it is there |
| --- | --- |
| `build` | `debug` rows are not reportable |
| `gpu` | Catches a silent fall back to CPU |
| `seconds_per_60s` | The brief's 45 s budget, normalised |
| `vad_fell_back` | VAD found no speech and fixed windows were used instead |
| `chunks` | Transcribe calls made. Each one is a full encoder pass |
| `lang_mode` | `detect-per-chunk` doubles the encoder passes |
| `peak_is_per_run` | `no` means the peak includes earlier models in the session |
| `source_hz` / `source_channels` | Confirms the resampler and downmix actually ran |
| `transcript` | Hand-count word error rate from this |

The VAD toggle on screen exists so a music clip can be measured with and without
the gate. If music word error rate blows past 25%, that pair of rows says whether
the gate is helping or eating the speech.

### What actually costs time

whisper's encoder runs at a fixed 1500 mel frames, which is 30 seconds, no matter
how much real audio the call contains. A 400 ms span costs the same encoder pass as
a 28 second one. Two consequences drive every timing number in the CSV.

Speech spans are packed into as few chunks as the 28 second window allows, rather
than transcribed one span at a time. Widening a chunk across the silence between
two spans is free, because the window is padded either way. A new chunk opens only
when the next span will not fit, which is what skips long stretches of no speech
instead of paying to encode them. On a 42 second clip this turned seven encoder
passes into two.

Auto-detecting the language runs a whole extra encoder pass per call, so a
multilingual model with `language: 'auto'` costs twice what the same weights cost
with the language fixed. The rig detects on the first chunk and reuses the answer.
Turn that off with the screen toggle to measure a clip whose speaker switches
language mid-sentence, where per-chunk detection may be worth paying for.

Read `chunks` and `lang_mode` together with `transcribe_ms`. Two runs of the same
model over the same clip are only comparable when both match.

Two more things to keep in mind when reading the numbers.

Android refuses the write to `/proc/self/clear_refs` that would reset the peak
memory watermark, so `peak_is_per_run` is `no` there and every peak is a process
lifetime high water mark. Models run cheapest first, so the first model's peak is
its own and a later one is meaningful only where it exceeds the model before it.
For a clean per-model number, run one model per app launch.

Each VAD span is transcribed as an independent utterance, so whisper punctuates
and capitalises each one on its own. Expect sentence case and terminal
punctuation at span boundaries that a single-pass transcript would not have. It
does not affect the words, and captions do not care, but do not count it as an
error when hand-scoring.

### Rig B

`spike/android-sherpa`, a native Kotlin app running sherpa-onnx over the same PCM
files Rig A writes. Not built yet.

## Conventions

- `src/domain` has no platform imports and its logic is unit tested first.
- Native modules expose one function and return a typed record. Logic stays in TypeScript.
- Every ASR call goes through one wrapper. Never call whisper.rn from a screen.
- Conventional commits. One vertical slice per pull request.

## Known upstream friction

- `.npmrc` sets `legacy-peer-deps`. Expo SDK 57 ships react 19.2.3 while expo-router
  pulls react-dom 19.3.0, whose react peer range is `^19.3.0`. React Native never
  loads react-dom, so the mismatch is inert. Remove the flag once Expo aligns the pins.
- `tsconfig.json` maps `whisper.rn` by path. Version 0.7.4 publishes an `exports`
  map with `./*` but no `.` entry, so TypeScript cannot resolve the package root.
  Metro falls back to the legacy `main` field at runtime.
- `buffer` is a direct dependency purely to satisfy whisper.rn. It imports
  `safe-buffer`, which does `require('buffer')`, and React Native has no such
  builtin, so Metro fails to bundle without the npm package present.
- whisper.rn's `transcribeData` and `detectSpeechData` take **signed 16-bit** PCM,
  not the float32 its README claims. The native code decodes the ArrayBuffer with
  `decodePcm16`. `audio-extract` produces s16le, which is what those want.
- whisper.cpp reports every timestamp in **centiseconds**, for VAD spans as well as
  transcription segments. The README example that prints VAD times as seconds is
  wrong. The rig multiplies by 10 at the boundary and keeps milliseconds inside.
