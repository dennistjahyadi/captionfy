# Captionfy

Offline, on-device auto-captions for short vertical video. No account, no upload,
no server. One React Native codebase for Android and iOS.

**Status: Phase 0.** Nothing here is the product yet. The only thing being built is
the Stage 0 accuracy spike that decides whether on-device transcription is good
enough on messy creator audio.

## Scope: v1 is English-only

This is a decision, not an open question. v1 transcribes English. Non-English
words inside an English sentence are handled by the dictionary feature, not by the
model. Video whose sentences are wholly in another language is out of scope.

Three reasons, in the order they carry weight.

**The measurement says so.** Round 1 ran multilingual `small-q5_1` against
English-only `base.en-q8_0` and `small.en-q5_1` on the same accented clips.
Multilingual was not a speed-for-accuracy trade. It lost on both: four times
slower, and wrong on names where the English-only models were right, turning a
first name into a different name and mangling a brand name past recognition. A
multilingual `base`, the only multilingual model small enough to ship, would be
worse still.

**It matches who the product is for.** A creator in Southeast Asia making English
content with a few Indonesian words in it is a user this can serve today. Those
words are overwhelmingly brand names, people's names, and local terms that repeat,
which is exactly what the dictionary is for. The user it cannot serve in v1 is the
one whose sentences are wholly in Bahasa. That is a normal v1 boundary. CapCut's
Bahasa captions are well below its English ones for the same reason.

**It holds the scope.** Supporting Bahasa properly means a different model, a
different word error rate threshold, a different test set, and possibly a different
engine. That is a second product, not a feature.

Round 2 still runs one `code-switch` clip. Not to reopen the decision, but to learn
the shape of the failure, because two outcomes have very different consequences. A
wrong phonetic guess at an Indonesian word with the timing still correct is
acceptable: the user fixes one line and the karaoke stays in sync. A dropped span,
or a hallucination that throws off every timestamp after it, has to surface in the
UI as a low-confidence line. One clip decides whether that handling is needed.

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

Pick a clip, decode its audio once, run every candidate model over those exact
bytes, write one CSV row per model. Audio and video are the same to it: the file
picker takes either, and `audio-extract` decodes whatever container the platform
can open.

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
| `base.en-q8_0` | `ggml-base.en-q8_0.bin` | 82 MB | The production candidate. The gate is about this. |
| `small.en-q5_1` | `ggml-small.en-q5_1.bin` | 190 MB | Accuracy ceiling reference. Shows what `base` gives up. |
| Silero VAD | `ggml-silero-v6.2.0.bin` | 3 MB | Gates every transcription |

Models download to the app document directory on first use. None is bundled.

Round 1 ran a third model, multilingual `small-q5_1`. It is gone. It was slower and
less accurate than both English-only models on the same accented clips, and v1 is
English-only anyway. See [Scope](#scope-v1-is-english-only).

### The test set

No public dataset matches the target audio, which is a creator with an
Indonesian-English or Vietnamese-English accent talking over a music bed on a
phone mic. The set is built in three layers instead, weakest evidence first.

**Accent, isolated.** The [Speech Accent Archive](https://accent.gmu.edu) has 14
Indonesian and 40 Vietnamese speakers reading one fixed English paragraph, so
ground truth is a known sentence rather than something you transcribe by hand.

```bash
./scripts/fetch-accent-samples.sh --count 5
```

These are clean read speech. No music, no street, no phone mic, no code-switching.
A good score here is a floor, not a pass. Licence is CC BY-NC-SA 4.0, so they are
for internal benchmarking and `test-clips/` is gitignored.

**Music under voice, as a dial.** Found footage carries an unknown amount of music,
so a bad score tells you nothing about how much music the model survives. Mixing
the bed yourself makes it a variable:

```bash
afconvert -f WAVE -d LEI16@16000 -c 1 bed.mp3 bed.wav
./scripts/mix-music-bed.py test-clips/accent/indonesian1.wav bed.wav test-clips/music/ --snr 20 10 5 0
```

Standard library only, no ffmpeg. The output hits the requested ratio to within a
hundredth of a dB. Run one speaker across several ratios and the number you want is
where accuracy falls over, which is worth more than a single verdict on one clip.
Beds from the [Free Music Archive](https://freemusicarchive.org) or
[ccMixter](https://ccmixter.org) under a Creative Commons licence.

**Real creator audio.** Neither layer above contains a phone mic, a room, traffic,
a fast talker, or a speaker dropping a non-English word mid-sentence. Those clips
have to come from real creators. This is the layer the pass/fail gate actually
rests on, and it is where the one `code-switch` clip belongs.

Push a built set, or drag the files onto a running emulator, and open it with
**Browse files** in the rig:

```bash
adb push test-clips /sdcard/Download/
```

Nothing copied onto a device this way is in MediaStore, so the gallery picker and
the document picker's Recent view both come up empty. **Browse files** sidesteps
that by opening straight on Downloads. Every clip opened this way lands in
**Recent clips**, which is one tap on the next run; the grant survives a restart,
so the list keeps working after the app is killed.

### Pass/fail

The rig produces numbers; word error rate is hand-counted from the `transcript`
column. The brief's gate was written around multilingual `small`, which is no
longer in the run set, so it is restated here for `base.en-q8_0`. `small.en-q5_1`
is a ceiling reference only and is never the thing that passes or fails.

- `base.en-q8_0` under 10% WER on `clean-accented` **and** under 15% on
  `music-under-voice` means proceed to Phase 1 with whisper.rn.
- Music clips over 25% WER means stop and report.
- Over 45 s for a 60 s clip, or an out-of-memory, on the slowest target phone means
  stop and report. The CSV's `seconds_per_60s` column is that number directly.
  There is no larger model to fall back to now: `small.en-q5_1` is the reference,
  and round 1 already showed it costs more than `base` for a gain the gate does not
  need.
- Word timestamps drifting past roughly 200 ms under music is a flag for a possible
  forced-alignment pass. The per-run `<clip>-<model>.words.json` files carry every
  word boundary.
- The `code-switch` clip has no threshold. It is read for the shape of the failure,
  not scored. See [Scope](#scope-v1-is-english-only).

Decide each threshold before reading the data. `small.en-q5_1` scoring better than
`base.en-q8_0` is expected and is not by itself a reason to change the plan; the
question is only whether `base` clears the gate.

### Running it

Measurements only count in a release build on a physical arm64 device. A debug
build is 10 to 20 times slower and the screen says so in red.

Plug the phone in, with USB debugging turned on, and run:

```bash
npm install
./run.sh                       # or: npm run phone
```

`run.sh` is the only script here. It builds, installs and launches, and two flags
change what it does: `--emulator` picks the device, `--dev` picks the build. It
finds the SDK, prefers a handset over any running emulator, builds only that
device's architecture, and explains what to do when nothing is found or the
signature does not match. `--fresh` wipes app data, which means downloading the
models again. `--skip-build` installs the APK that is already built. `--logs`
tails the pipeline afterwards. `./run.sh --help` lists the rest.

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
./run.sh --dev                 # or: npm run dev
```

That builds once, installs, and leaves Metro running. Save a change to
`spike/rn-whisper/` or `app/` and the phone redraws in about a second. Only native
changes need the command again: anything under `modules/`, the plugin list in
`app.json`, or a new dependency with native code.

Both variants are signed with the same debug keystore and share a package name, so
switching between `--dev` and the release install keeps the 275 MB of downloaded
models in place. No `--fresh` needed.

The banner reads `DEBUG BUILD` in red the whole time. That is the point: nothing
measured in this mode is reportable. Re-run `./run.sh` for numbers.

With no phone to hand, the same loop runs on an emulator beside the editor:

```bash
./run.sh --emulator            # or: npm run emulator
```

That boots an AVD, waits for it, and carries on into the same build, install and
Metro steps as `--dev`, which is why it is one script and not two. It reuses an
already running emulator and leaves it running afterwards, so a second run skips
straight to the build. Pass an AVD name to pick one, or `--cold` to ignore a
snapshot that boots to a black screen. `--emulator` defaults to the debug build
because an emulator cannot produce a reportable number either way; add `--release`
to override that.

Create the AVD in Android Studio under Device Manager. On Apple Silicon choose an
`arm64-v8a` system image, which is also the architecture a real handset uses.

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

Neither build path pays for both. `run.sh` reads the target device's own ABI and
passes `-PreactNativeArchitectures` to Gradle for the debug build as well as the
release one, so a run compiles whisper.cpp exactly once.

Watch the pipeline:

```bash
adb logcat -s RNWhisper:* Caption:*
```

Every CSV row is mirrored to the `Caption` tag as `CSV_ROW ...`, because release
builds cannot be read with `adb run-as` and JS `console.log` is not dependable once
the bundle is minified. The rig also writes the files below and has a Share button.

```
<app documents>/spike-results/rig-a.csv                    one row per (clip, model)
<app documents>/spike-results/<clip>-<model>.words.json    word timings, one file per run
```

The words file is an array of `{ word, t0, t1 }` in milliseconds from the start of
the clip. Round 1 wrote a single shared `rig-a-words.jsonl` instead; one file per
run replaced it so a clip can be opened on its own.

### Reading the CSV

Columns worth knowing:

Every column is documented in [spike/ROUND2.md](spike/ROUND2.md). The ones worth
knowing before you open the file:

| Column | Why it is there |
| --- | --- |
| `build` | Only `release` rows are reportable. `debug` and `emulator-*` are not. |
| `noise_tag` | Your label for the clip. Analysis only; nothing branches on it. |
| `gpu` | Catches a silent fall back to CPU |
| `seconds_per_60s` | The brief's 45 s budget, normalised |
| `vad_fell_back` | VAD found no speech and fixed windows were used instead |
| `chunks` | Transcribe calls made. Each one is a full encoder pass |
| `lang_mode` | `detect-per-chunk` doubles the encoder passes |
| `peak_is_per_run` | `no` means the peak includes earlier models in the session |
| `source_hz` / `source_channels` | Confirms the resampler and downmix actually ran |
| `transcript` | Hand-count word error rate from this |
| `notes` | Always empty. Yours, for the WER count you just made. |

Round 1 had on-screen toggles for the VAD gate and for language detection. Round 2
holds both fixed and shows them as read-only, because a row run with different
settings compares with nothing. If music word error rate blows past 25% and the
suspicion is that the gate ate the speech, read `speech_seconds` against
`clip_seconds` and `vad_fell_back` first; changing the setting is a separate
experiment, run deliberately and noted.

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
with the language fixed. That is most of why multilingual `small` came in at four
times the cost of `small.en` with identical weights and size. Round 2's two models
are both English-only and pinned to `en`, so they never pay it, and `lang_mode`
reads `detect-once` on every row.

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
