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
   The overlay held 61 fps in a release build there and produced no redraws at
   all while paused. The canvas following the video's own rectangle was checked
   on a 568×320 clip; a rotated phone recording, where the track dimensions and
   the upright ones disagree, is still unproven.
4. Word sheet, edit, undo and redo, low-confidence chip.
   **Done, verified on an Android 16 emulator only. Not yet run on the A54.**
   Checked on a real 173-word transcript: the chip walks the flagged words, an
   edit clears the flag and the count, "Fix 1 more like this" corrected both
   mishearings as one step, undo put both back, an override moved the big word
   inside its own line and nowhere else, and every change survived leaving the
   editor and coming back.
5. Timing sheet and shift-all.
6. Style sheet with the four presets.
7. Export, with a preview-versus-export frame comparison.
8. Dictionary.
9. First launch and Unlock. Ask about free-tier policy before starting this.

Every slice runs as a release build on the Galaxy A54 before it is called done.

## Known issues, none of them fixed yet

Found while accepting slices 3 and 4, all on an Android 16 emulator. Small, real,
and worth carrying forward rather than rediscovering.

- **The box highlight crowds its neighbours.** `BOX_PAD.x` is 0.22 em each side,
  which is wider than a space, so the box reaches the first glyph of the next
  word. The default preset is the one affected. Two fixes: a smaller pad, or a
  wider word gap in box mode. The gap has to be uniform across the line or words
  would shift as the highlight travels, which is worse. Yours to pick.
- **The delete confirmation does not name the project.** Two rows of the same
  length and word count look identical in the dialog, and one of them is the
  user's real work. It should say which.
- **Home writes "1 words".** A project with one word reads "1 words · ready".
- **`SHOW_OVERLAY_FPS` in the editor is still true**, which is why the fps line
  shows under the scrubber. Deliberate: the A54 run needs a number to read. Turn
  it off once slices 3 and 4 are accepted there.
- **The picker's duration can be wrong.** One project stored 53 s for a clip the
  player reported as 60 s, and `project.durationMs` comes from
  `asset.duration`. It seeds the progress bar and the relink warning today, and
  slice 7 needs real numbers, so Export should read length, resolution and frame
  rate from the source rather than trusting the picker.
- **Slices 3 and 4 have not run on the A54.** Every verification in them is from
  an emulator, which means no reportable timings and nothing said about the real
  phone's frame rate.
- **iOS has never been built.** Not once, in any slice. Nothing is known about
  the Skia overlay, the fonts, the player or the pause-on-background rule there.
- **A junk project sits on the emulator**, "0:53 · 1 word" with colour bars, left
  from testing. Harmless, and yours to delete.

The model decision in the build prompt now has its number: the release APK is
62 MB with no model, so bundling `base.en-q8_0` lands near 120 MB, inside the
150 MB line.

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
- The word sheet shows the actions that exist. Timing joins it in slice 5 and
  Dictionary in slice 8, rather than sitting there disabled in the meantime.
- Delete is a plain action at the foot of the sheet, not inside an overflow. One
  item is not a menu, and undo is in the toolbar for every action equally.
- Sheet actions are labels without icons, because no icon set has been chosen and
  a hand-drawn one per action would be four inconsistent glyphs.

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

## Editing

Every change to a project goes through `useProjectEditor.edit`, which is what
keeps undo, the local emphasis recompute and the save policy in one file instead
of in every screen. Undo is snapshots, not inverse operations: an edit already
returns a whole new project sharing the words it did not touch, so keeping the
old value costs pointers, while inverting a merge or a split is a chance to
restore something subtly different. Depth is capped at 100.

Writes are debounced by 500 ms and flushed when the app leaves the foreground or
the screen unmounts.

`timingDrift` runs on every text edit, on the phone, against the real
transcript: with the word count unchanged nothing may move at all, which is
invariant 1 exactly, and when a split, merge or delete has changed the count what
is checked instead is that no time was invented outside the span that was there.
A failure says so and refuses to write. Unit tests prove the same rules against
fixtures; this is the copy that runs on the user's own words.

## Emphasis

Emphasis is data, picked in `emphasis.ts` from how the word was said: loudness
over the clip's speech median, how long it was held, the pause around it, plus
numbers, dictionary spellings and names. Every weight sits in one `EMPHASIS`
object. Stopwords and unverified low-confidence words are barred outright.
`autoEmphasis` is frozen at `ready` and re-picked only in the edited display unit
and one either side. Each preset decides how an emphasised word looks.

The word sheet carries the toggle and says which way the word was decided.
Emphasised words are bold in the transcript. Still to come: Editorial in the
style picker, animating the user's own line with its real picks (slice 6).

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
