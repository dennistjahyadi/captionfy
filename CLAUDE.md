# Captionfy — working notes

Offline, on-device auto-captions for short vertical video. No account, no upload,
no server. README.md carries the Stage 0 spike; this file carries the product.

## Stack

Expo dev client, New Architecture. whisper.rn 0.7.4 (patched, see `patches/`)
with Silero VAD. Native Expo Modules for audio extraction and burn-in.
react-native-skia 2.6 for the overlay, react-native-iap for the one-time unlock,
EAS Build. Fonts: Be Vietnam Pro and Spectral, both OFL, in `assets/fonts/`.

Skia 2.x requires react-native-reanimated, which in turn requires
react-native-worklets. Both are installed for that reason alone; nothing in the
app animates through them, because the caption animation is computed inside
`layoutCaptionFrame` where the export can run it too. `babel-preset-expo` adds
the worklets plugin on its own once the package is present, so there is still no
`babel.config.js`.

## Scope

**v1 is English-only.** Model is `base.en-q8_0`. The multilingual model is
dropped and there is no language picker anywhere in the app. Non-English words
inside an English sentence are the dictionary's job. See README for the evidence.

Out of scope: other languages, language detection, translation, cloud anything,
accounts, trimming, multiple speakers, emoji or B-roll or auto-zoom, iOS
background continuation, a fifth style preset, SRT import, and text behind the
speaker (the draw list reserves `layer` for it; build no segmentation now).

## Invariants — write tests for these, do not trade them away

1. **Editing a word's text never changes its timing.** Timing moves only through
   nudge, shift, split and merge.
2. **Preview equals export.** One `layoutCaptionFrame` produces the draw list;
   the Skia preview and the burn-in both consume it. No second layout anywhere.
3. **No lost work.** A project file is written the moment a video is picked and
   every finished ASR segment is checkpointed.
4. **Audio plays while editing**, on every editing surface.
5. **No surprises at export.** The free-tier limit is on Home before the picker.
6. **Low confidence lives in the transcript only.** Never on the preview, never
   in the export. `layout.ts` does not import `confidence.ts`.
7. **All timing is integer milliseconds.** Convert at the edges only.

## Slice order — stop after each for review

1. Domain module and tests. **Done.**
2. Home and Processing: whisper.rn, checkpointing, an Android foreground service
   of type `mediaProcessing`, falling back to `dataSync` below Android 15.
   **Done. Both acceptance tests pass on the A54.** The service runs there as
   `types=00000001`, the `dataSync` branch. `mediaProcessing` is unverified: the
   only Android 15+ hardware to hand was an emulator, which starts the service
   and then stops it with "does not have any types" for reasons unknown.
3. Editor read-only: Skia overlay from `layoutCaptionFrame`, tap to seek.
   **Done, verified on an Android 16 emulator only. Not yet run on the A54.**
   The overlay held 61 fps in a release build there. Two open points are in the
   slice 3 report: the box highlight crowds the words either side of it, and the
   preview canvas is the video's own rectangle, which needs a rotated phone
   recording to confirm.
4. Word sheet, edit, undo and redo, low-confidence chip.
5. Timing sheet and shift-all.
6. Style sheet with the four presets.
7. Export, with a preview-versus-export frame comparison.
8. Dictionary.
9. First launch and Unlock. Ask about free-tier policy before starting this.

Every slice runs as a release build on the Galaxy A54 before it is called done.

## Deviations from the UI spec, all accepted

- `layoutCaptionFrame` takes a text measurer: two measurers would be two layouts.
- `Word.confirmed` carries "Looks right", which must clear the low-confidence
  flag without overwriting the engine's probability.
- `mergeWords(words, ids)` takes a list and joins without a separator, since a
  merged word holding a space would be split apart by the next text edit.
  Keeping words together on a line is `setBreakAfter(id, 'none')`.
- Max rows is a style property. One line on screen is structural: `displayUnits`
  returns the units the viewer sees one at a time.
- Emphasis takes an `EmphasisContext`, because the envelope the features come
  from is not in the project, only its path.

## Persistence

A project owns everything it needs: `project.json`, `pipeline.json`, `audio.pcm`,
`envelope.f32`, `thumb.jpg`, and `source.<ext>`, the video itself.

The video is copied in at pick time and the project never refers to anything
outside its own directory. The picker does not hand back the file in the gallery,
it hands back a copy in this app's cache, and a project pointing at that copy
opens on a black rectangle the moment the system reclaims the space. When the
video is missing anyway, the editor says so and offers to pick it again, because
the transcript is the expensive part and it is still there.

## Rendering

`src/render` is the only consumer of a draw list, and it decides nothing.
`faces.ts` maps a `FaceSpec` onto one of the five bundled files, `typefaces.ts`
loads them into Skia under those exact names so a match is a lookup and not a
guess about embedded weight metadata, `measure.ts` builds the one measurer
(memoised, and a cached measurement equals a cold one), `frame.ts` segments a
project once and hands every frame to the same layout, and `CaptionOverlay.tsx`
draws what it is given. The burn-in will build its own measurer over the same
faces at export resolution, which is how invariant 2 survives the bridge.

The preview canvas is the video's own rectangle inside the stage, not the stage,
because every ratio in the layout is a fraction of the canvas and the export
renders into the frame rather than into the letterbox.

One clock reads the player once per display frame and the overlay, the scrubber
and the transcript subscribe to it. Nothing above them re-renders, which is what
keeps the video view out of the render loop.

## Emphasis

Emphasis is data, picked in `emphasis.ts` from how the word was said: loudness
over the clip's speech median, how long it was held, the pause around it, plus
numbers, dictionary spellings and names. Every weight sits in one `EMPHASIS`
object. Stopwords and unverified low-confidence words are barred outright.
`autoEmphasis` is frozen at `ready` and re-picked only in the edited display unit
and one either side. Each preset decides how an emphasised word looks.

UI hooks not built yet: a "Make big" / "Make normal" toggle in the word sheet
with "Picked automatically" above it, and bold emphasised words in the transcript
(slice 4); Editorial in the style picker, animating the user's own line with its
real picks (slice 6).

## Things Android taught us the hard way

- `ServiceCompat.startForeground` masks the requested type against the ones its
  androidx version knows, and hands the framework a zero for `mediaProcessing`.
  The platform then refuses to start a typed service with no type and the app
  dies on the main thread. Call `Service.startForeground` directly.
- Never await a foreground-service call from the pipeline. One that did not
  settle stopped a run between two chunks with every chunk already on disk.
  The notification is a courtesy; the transcription is the product.
- Android 15 gives a typed service a time budget and calls `onTimeout`. Ignore
  it and the app is killed.
- `expo-video` loads a source handed to `useVideoPlayer` before an effect on the
  same render gets to subscribe, and `sourceLoad` does not replay for a listener
  that arrives late. Read `player.videoTrack` and `player.duration` directly as
  well as listening, or the screen never learns the shape of the video.
- A release build is not debuggable, so `adb shell run-as` cannot reach the app's
  own files. Seeding a fixture project into app storage needs the debug build.
- `expo-image-picker` returns a copy it made in `cache/ImagePicker`, not the file
  in the gallery. That copy does not last. A project that keeps the URI plays
  until the cache is cleared and then opens black with a play button that does
  nothing, which is how this was found. `adb shell pm trim-caches 4096G`
  reproduces it on demand.
- React Native's Android alert calls `options.onDismiss` when a button closes the
  dialog, not only when the dialog is dismissed, so a promise wrapped around an
  alert cannot tell the two apart and latches onto whichever fires first. Put the
  work in the button's own callback and do not await an alert.

## Conventions

- `src/domain` has no platform imports and is unit tested first.
- Native modules expose one function and return a typed record.
- Every ASR call goes through one wrapper. Never call whisper.rn from a screen.
- Conventional commits. One vertical slice per pull request.
