# Round 2 — music under voice

Round 1 answered the easy half: clean speech works. `base.en-q8_0` was under 1% WER
on a 57 s native-English clip and 6-9% on a 34 s Indonesian-accented one.
Multilingual `small-q5_1` was worse on accented audio and four times slower, so it
is gone.

Round 2 asks the question the product depends on: what happens to word error rate
and to word timings when there is music or street noise under the voice.

v1 is English-only. That is decided, and round 2 does not revisit it. The reasoning
is in the project README under Scope.

Nothing in the pipeline changed between the rounds. Same extraction, same VAD, same
whisper settings. That is deliberate: a pre-processing tweak would make round 1 and
round 2 incomparable, which costs more than it buys.

## Running it

```
./run.sh            # phone, release build. The only reportable timings.
```

On the device:

1. The banner at the top must be green. Red means debug build or emulator, and
   every timing from that run is noise. The rows are still written, tagged so they
   can be filtered out.
2. **Download models** once, on wifi. About 275 MB.
3. **Browse files** opens on Downloads and takes audio or video.
4. Name the clip. The name goes in the CSV and in the words file name, so name it
   for scoring later, not for now.
5. Pick a **noise tag**. The run button is dead until you do. The tag is written to
   the CSV and read by nobody else: no code branches on it, so a `music-under-voice`
   clip takes byte-for-byte the same path as a `clean-native` one.
6. Run. Both models go over the same decoded PCM.
7. **Share CSV** and **Share last words JSON** pull the files off the device.

The plan is 8 clips: 5 `music-under-voice` (one of those outdoors, tagged
`street-noise` instead), 2 `clean-accented`, and 1 `code-switch`. Two models each,
so 16 rows.

The `code-switch` clip is not scored and does not change the model choice. v1 is
English-only and that is settled. It is there to show which of two failures happens
when an Indonesian word lands in an English sentence. If `base.en` writes a wrong
phonetic guess and the word timings around it stay correct, that is acceptable: the
user edits one line and the karaoke stays in sync. If it drops the span or
hallucinates and the timestamps after it are wrong, the UI has to flag that line as
low confidence. Read the words file, not just the transcript, to tell them apart.

Held fixed for every run, and shown on the screen so a mismatch is visible:
`maxThreads: 4`, `maxLen: 1`, `tokenTimestamps: true`, VAD on, language `en`
detected once. The VAD and language switches are gone from the screen; they were a
way to accidentally produce a row that compares with nothing.

Watch it work from the Mac:

```
adb logcat -s RNWhisper:* Caption:*
```

Every CSV row is mirrored to that log tag, which survives a release build.

## Files it writes

Both land in the app's documents directory under `spike-results/`.

- `rig-a.csv` — one row per (clip, model).
- `<clip>-<model>.words.json` — one file per model run. An array of
  `{ word, t0, t1, dtw_t0, dtw_t1 }`, milliseconds from the start of the **clip**,
  not of the chunk whisper actually saw. This is the karaoke-drift evidence: on a
  music clip, read each start against where the word really lands.

  The two pairs are two ways of timing the same word. `t0`/`t1` is whisper.cpp's
  heuristic, which is what round 1 measured and what whisper.rn exposes out of the
  box. `dtw_t0`/`dtw_t1` is dynamic time warping over the decoder's
  cross-attention, the method OpenAI's own `word_timestamps=True` uses. It is
  compiled into whisper.cpp but whisper.rn hardcodes it off; `patches/` turns it
  on, and the rig opens each model with the alignment-heads preset that matches
  its weights. DTW gives one instant per token, the moment it was emitted, so a
  word's `dtw_t1` is simply the next word's `dtw_t0`. One run of the music dial
  therefore answers which method drifts less, without running anything twice.

Running the same clip name twice appends a second CSV row but overwrites the words
file. Change the clip name if you want to keep both.

If `rig-a.csv` on the device was written by an older build, the rig moves it to
`rig-a-<timestamp>.csv` and starts a fresh file rather than appending new rows under
an old header. That is exactly what corrupted round 1's file, and it is now loud
instead of silent. Old rows are never rewritten.

## Reading the CSV

35 columns. Sorting by `clip` then `model` puts the two models for one clip
side by side, which is the comparison round 2 is for.

| Column | Meaning |
| --- | --- |
| `started_at` | ISO timestamp when the run finished assembling its result |
| `device` | Manufacturer and model, e.g. `samsung SM-A546E` |
| `soc` | Chipset, from `Build.SOC_MANUFACTURER`/`SOC_MODEL` |
| `os` | Android release and API level |
| `cores` | CPU cores the JVM reports |
| `build` | `release`, `debug`, `emulator-release`, `emulator-debug`. **Only `release` rows have usable timings.** |
| `clip` | The name you typed. Also the prefix of the words file. |
| `noise_tag` | Your label: `clean-native`, `clean-accented`, `music-under-voice`, `street-noise`, `multi-speaker`, `code-switch`. Analysis only. |
| `model` | `base.en-q8_0` or `small.en-q5_1` |
| `model_file` | The exact ggml file, so the quantisation is never ambiguous |
| `threads` | `maxThreads` passed to whisper. 4 for every round 2 row. |
| `gpu` | `yes` when whisper reported a GPU backend. Always `no` on Android. |
| `clip_seconds` | Decoded audio duration |
| `speech_seconds` | Total length of the VAD speech spans. Much lower than `clip_seconds` means VAD threw audio away, which on a music clip is the first thing to suspect. |
| `vad_enabled` | `yes` for every round 2 row |
| `vad_fell_back` | `yes` when VAD found no speech at all and the whole clip was transcribed in fixed 28 s windows. A `yes` here on a music clip is itself a finding. |
| `vad_spans` | How many speech spans VAD found |
| `chunks` | **One of the two columns missing from round 1's file.** How many transcribe calls those spans were packed into. Spans are packed into 28 s windows because whisper's encoder costs the same for a 0.4 s call as a 28 s one, so this, not `vad_spans`, is what drives `transcribe_ms`. |
| `lang_mode` | **The other one.** `detect-once` or `detect-per-chunk`. Auto-detection costs a whole extra encoder pass per call; `detect-once` pays it once. Always `detect-once` in round 2. |
| `dtw` | `yes` when every token came back with a DTW timestamp, so the words file carries both timings. `no` means the whisper.rn patch is not in the build you ran; see below. |
| `source_hz` | Sample rate of the source file before downmix and resample |
| `source_channels` | Channel count of the source file |
| `extract_ms` | Decode to 16 kHz mono PCM |
| `vad_ms` | Speech detection over the whole clip. Charged once per clip, not per model. |
| `transcribe_ms` | Model load plus every transcribe call for this model |
| `seconds_per_60s` | `transcribe_ms` normalised to 60 s of clip. The budget in the brief is stated this way. |
| `realtime_factor` | `transcribe_ms / clip_seconds`. Below 1.0 is faster than real time. |
| `peak_rss_mb` | Peak resident memory during this model's run |
| `peak_is_per_run` | `no` when the kernel refused to reset the watermark, so the peak covers earlier runs too and is an upper bound |
| `words` | Word count after whisper's sub-word tokens are merged back into words |
| `first_word_ms` | Start of the first word, ms from clip start |
| `last_word_ms` | End of the last word. Far short of `clip_seconds` means the tail was dropped. |
| `language` | What whisper reported. Pinned to `en` by both round 2 models. |
| `error` | Empty on success. Non-empty rows have no usable transcript. |
| `transcript` | Full text, quoted. Hand-count WER from here. |
| `notes` | Always empty. Yours, for WER counts and anything about the clip the rig cannot know. |

### The two columns that were missing

They are `chunks` and `lang_mode`, and they were never missing from the source.
Both were added in `perf(spike): stop paying an encoder pass per speech span`, to
the header and to the values in the same commit.

What was wrong is the file on the phone. `appendRun` wrote a header only when the
file did not exist, so the CSV created by the pre-that-commit build kept its
32-column header while the newer build appended 34-value rows underneath it.
Everything from `source_hz` rightward read as the field two places to its left,
which is why `transcript` held a language code and the real transcript sat in an
unnamed 34th column.

Three things stop a repeat. Values are keyed by column name in
[row.ts](rn-whisper/row.ts), so a value cannot drift into a neighbouring column
whatever the header does. `assertCsvShape` runs when the rig loads and throws
before any clip runs. A CSV whose first line is not this build's header is moved
aside instead of appended to.

## When you report a number

State the build and the device with it. A timing from a `debug` or `emulator-*` row
is not a slow number, it is not a number. Say which it was instead of quoting it.
