# Wordburn — working notes

Offline, on-device auto-captions for short vertical video. No account, no upload,
no server. README.md carries the Stage 0 spike; this file carries the product.

## Stack

Expo dev client, New Architecture. whisper.rn 0.7.4 (patched, see `patches/`)
with Silero VAD. Native Expo Modules for audio extraction and burn-in.
react-native-skia 2.6 for the overlay, expo-iap 5.6 for the one-time unlock,
EAS Build. Fonts: Be Vietnam Pro and Spectral, both OFL, in `assets/fonts/`.

**The models are in the APK.** `base.en-q8_0` is 81.8 MB and the Silero VAD is
0.9 MB, on top of a 62.9 MB app: an install of about 145 MB, inside the 150 MB
line. They live in `assets/models/`, which is not in git — `scripts/fetch-models.sh`
puts them there by exact byte count and `run.sh` calls it before every build.
`plugins/with-bundled-models.js` points the app's asset directory at them and
turns compression off for `.bin`, the same trick the burn-in module uses for
`assets/fonts`. whisper.rn opens them through Android's AssetManager, so nothing
is unpacked and there is no second copy of 82 MB on the phone.

expo-iap rather than the react-native-iap this file used to name: that library's
current release sits on react-native-nitro-modules, a second native module system
next to the Expo Modules this app is already built from. expo-iap is the same
author's Expo-Modules build of it, has no runtime dependencies, and pins the
exact expo, react and react-native versions in use here.

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
   **Done. Verified on an Android 16 emulator, and driven on the A54 in slice 10.**
   The overlay held 61 fps in a release build there and produced no redraws at
   all while paused. The canvas following the video's own rectangle was checked
   on a 568×320 clip; a rotated phone recording, where the track dimensions and
   the upright ones disagree, is still unproven.
4. Word sheet, edit, undo and redo, low-confidence chip.
   **Done. Verified on an Android 16 emulator, and driven on the A54 in slice 10.**
   Checked on a real 173-word transcript: the chip walks the flagged words, an
   edit clears the flag and the count, "Fix 1 more like this" corrected both
   mishearings as one step, undo put both back, an override moved the big word
   inside its own line and nowhere else, and every change survived leaving the
   editor and coming back.
5. Timing sheet and shift-all.
   **Done. Verified on an Android 16 emulator, and driven on the A54 in slice 10.**
   On a real 173-word transcript: the steppers, both handles and a whole-word
   drag all moved the word and no other, Apply survived leaving the editor and
   coming back, Cancel and undo both put it back, and shift-all held at −150 ms
   because the first word starts there. The first build of the sheet could not
   move anything at all, which is the deviation below.
6. Style sheet with the four presets.
   **Done. Verified on an Android 16 emulator, and driven on the A54 in slice 10.**
   All four tiles animate the same line through the one layout, a picked colour
   lands on whatever each preset paints and follows a preset switch, size,
   position and words per line apply live, and the look survived leaving the
   editor and coming back. Undo of a word edit left the style alone.
7. Export, with a preview-versus-export frame comparison.
   **Done, and this one ran on the A54.** A 0:40 clip at 576×1024 burned in and
   landed in the gallery in 7 seconds, audio copied across untouched, 30 fps in
   and 30 fps out by `ffprobe`, 1217 frames for 40.57 seconds. The .srt came out
   valid subrip, 37 cues. The free counter fell 2 → 1 → 0 only on a successful
   save, and at 0 the button reads "Unlock to export" before anything renders.
   Slice 9 measured what this one could not: two 1080 × 1920 exports of a 0:22
   clip at 7 seconds each. Sixty seconds at 1080p is still unmeasured. The free
   tier no longer has to be spent to find out — the debug-APK dance in the build
   notes resets `entitlement.json` without touching projects or models.
8. Dictionary.
   **Done, verified on an Android 16 emulator.** Slice 9 put its list screen, its
   cap dialog and its footer count on the A54; the word-sheet route into it and
   applying an entry to a transcript are still emulator-only.
   One tap from a word sheet opens the dictionary with the entry half written,
   saving returns to the editor, and the chip there offers to apply it to the
   transcript already on screen as one undo step. A new transcription reads the
   dictionary at the start of the run and feeds the spellings to whisper as an
   initial prompt.
9. First launch, Unlock, IAP and the free-export counter.
   **Done, and this one ran on the A54.** The free tier is **3 exports**, full
   quality, no watermark. The models moved into the APK, which deleted the Model
   setup screen. `minSdkVersion` is 29.
   On the phone: Welcome drew its serif headline and its Restore said "No
   purchase found for this account" against a Play Billing connection that had
   genuinely answered (`Finsky: Billing preferred account via installer for
   com.captionfy.app` in logcat). A 0:22 clip picked from the gallery transcribed
   to 46 correct words with the model read straight out of the APK and
   `files/models` deleted from app storage. The counter fell 2 → 1 → 0 on
   successful saves only, and at 0 the button read "Unlock to export" before
   anything rendered. With `entitlement.json` seeded unlocked, Home showed no
   chip, Settings read "Unlocked · Sep 13, 2026", Export offered "Save to
   gallery" at three exports used, and Unlock showed the Unlocked screen. Reset
   to a fresh entitlement, Home read "3 free exports left". The dictionary at
   20 words offered its cap dialog and its Unlock button opened the screen.
   Also measured, which slice 7 could not: two 1080 × 1920 exports of a 0:22
   clip, 7 seconds each.
   **The purchase itself has never happened** — see Known issues.

10. Polish pass.
    **Done, on the A54.** Cold start, measured by recording the screen at 60 fps
    and reading the frames: Android reports `Displayed +186–196 ms` across three
    runs, and Home is fully drawn — chip, list and all — **0.30 s** after the
    launcher starts handing over.
    The overlay's own counter, release build, 127 word transcript: **0 fps
    paused**, **75–81 fps playing**. Against `dumpsys gfxinfo` over six seconds
    of playback: 678 frames, 5.8% janky, 50th 6 ms, 90th 9 ms, 99th 13 ms. With
    the style sheet open and its four live tiles: 633 frames, 36.7% janky, 50th
    9 ms, 90th 20 ms, 99th 36 ms. That is the cost CLAUDE.md predicted was worth
    reading, and it is real but not a broken screen — see below for where it
    goes and why nothing was changed.
    At **130% system font scale**: Home, the editor, Export, Unlock, Settings and
    all three sheets hold. The word sheet grows a row and still fits, the timing
    sheet keeps its waveform and all six steppers, the style sheet scrolls to
    Words per line. Nothing clipped, nothing unreachable, no overlapping lines —
    explicit `lineHeight` values smaller than the scaled `fontSize` turned out to
    be fine, because Android grows the line box rather than clipping.
    Reduced motion is now honoured by the chrome as well as the captions.
    Share reached **Instagram's Reels composer** and stopped at its account
    picker. Empty Home reviewed by hiding `files/projects`.
    Two 576 × 1024 exports of a 0:41 clip: 8 s each, 11.5 MB.
    One suspected defect turned out not to be one — see below.

Every slice runs as a release build on the Galaxy A54 before it is called done.

## Known issues

Three are left, and none of them can be closed from this machine.

- **Nobody has ever bought anything.** Play Billing connects, and the product
  query answers — with nothing, because `captions_unlock_v1` does not exist in
  any Play Console. So `buyUnlock`, the purchase sheet, the pending state, the
  acknowledgement and a real restore on a second device are all unrun code. What
  has been verified on the phone is the shape around them: the connection opens,
  the query answers, the price is asked for, a missing product is reported as one
  and the screen offers Try again. The rest needs an internal testing track and a
  licence-tested account, and the app has to be uploaded before any of it exists.

- **iOS has never been built.** Not once, in any slice. Nothing is known about
  the Skia overlay, the fonts, the player or the pause-on-background rule there,
  and there is no iOS burn-in at all.
- **TikTok has never received a share.** Slice 10 took a finished export into
  Instagram's Reels composer, as far as its account picker, which is where a
  machine should stop inside somebody's real account. TikTok proper is not
  installed on the A54 — only TikTok Shop Seller — so that half is unproven.

Closed in slice 10: slices 3 to 6 had never run on the A54, and now they have.
The editor, the word sheet, the timing sheet and the style sheet with its four
live tiles were all driven on the phone, and the overlay's frame rate was read
off a release build there (75–81 fps playing, 0 paused). `SHOW_OVERLAY_FPS` in
the editor is the switch; it goes back to false in what ships.

Closed in slice 9: the .srt could not be saved below Android 10, because
MediaStore's permissionless write arrived there and `minSdkVersion` was 26. The
floor is 29 now. The alternative was a legacy storage path that nobody here owns
a device to run, and this app is unusable on that hardware anyway — `base.en` on
a 2017 phone is not a product.

Closed after slice 4, all found while accepting slices 3 and 4: the box highlight
crowding its neighbours, a delete dialog that did not name what it was deleting,
"1 words" on Home, the fps readout shipping switched on, and a picker duration
that disagreed with the file by seven seconds.

The model decision is made and the number it was made on was wrong. This file
said bundling lands "near 120 MB"; the real weights are 81.8 MB and 0.9 MB
against a 62.9 MB app, so it lands at about 145 MB. Still inside the 150 MB line,
by five megabytes rather than thirty. Anything else that wants to ride in the APK
has to argue with that gap.

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
- **An edge a word shares with its neighbour is a boundary, and moving it moves
  both words.** The engine hands back one boundary between one word and the next,
  so on a real transcript every handle was already against a wall and the first
  build of the timing sheet could not move anything at all. A shared edge now
  carries the neighbour with it, as far as the neighbour's own `MIN_WORD_MS`. A
  handle at a gap still stops dead: the silence is not the neighbour's to give
  away. `nudgeWord` owns this; `setWordTiming` stays the unlinked primitive.
- Shift-all works in totals, not increments: the readout is where the captions
  are, so opening it a second time says what the first visit decided.
- Shift-all is a chip in the toolbar rather than the spec's overflow menu, for
  the same reason Delete is not in one. Rename and Delete join it in a later
  slice and an overflow can arrive with them.
- The style sheet's preview is the editor's own stage rather than a second copy
  inside the sheet. One video view, one overlay, one layout; the stage gives up
  height while that sheet is open so the captions are not behind it.
- The style sheet stores **choices**, not properties: a colour, a size, a
  position, a words-per-line, each only when it differs from the preset it was
  set on. That is what lets a colour follow the user from preset to preset while
  Clean subtitle still looks like Clean subtitle. `styleChoices` reads them back
  out of a project and `styleOverridesFor` puts them onto a preset.
- One colour control, not one per preset property. The swatch paints the box in
  Box highlight, the fill and the spoken words in Karaoke, and the big word in
  the two presets that mark nothing as it is spoken — and the big word in all
  four, so switching preset keeps it. `accentColor` reports the same colour back,
  which is why the chrome turns with it.
- A colour picked in Clean subtitle does colour its big word. A preset that
  answered a swatch with no visible change would read as broken.
- Export and Saved are `/export/[id]` and `/saved/[id]`, following Processing
  rather than the spec's nested `/project/[id]/export`. One shape for every
  screen that is about one project.
- The video is saved through `expo-media-library`, as the build prompt's stack
  says, asked for **write-only** and for **video alone**. That combination comes
  to no permission at all on Android 13 and up, which is what the module's own
  MediaStore code was for: adding a file you own needs none. Asked the default
  way the library opens with "allow access to music and audio on this device"
  and then asks for every photo as well, which was measured on the A54 before it
  was narrowed. The subtitle file still goes through MediaStore in the module,
  because a subtitle is not media and no media library will take one.
- Permission is asked for before the render rather than after: a sheet at the end
  of a minute of encoding is an export that failed at the last step.
- The burn-in is Android only. iOS has never been built in any slice, and a Swift
  implementation nobody can run is a file that rots rather than a feature.
- The custom colour is a hue strip and not a full picker: a washed-out caption is
  an unreadable one, so saturation and lightness are fixed and the swatches carry
  white. Dragging on it changes the colour rather than scrolling the sheet, as
  any slider does.
- Box mode spaces every word by the box's own padding on top of a space, so the
  words sit a little wider apart than in the other presets. The box is padded
  past its own word and a space is narrower than that padding, so the choice was
  an airier line or a highlight sitting on the next word's first letter. The gap
  is uniform rather than only around the active word: a gap that moved with the
  highlight would shove the line sideways on every word.
- `project.durationMs` starts as the picker's claim and is replaced by the
  decoded audio's own length once the PCM exists, because the picker has been
  seen to be seven seconds out on a sixty second clip.
- **There is no Model setup screen.** Screen 2 of the spec existed to watch an
  83 MB download and to have somewhere to fail; the models are in the APK, so
  Welcome goes straight to Home and the whole screen, its progress bar, its
  offline copy, its checksum retry and Processing's "finishing model download"
  first stage are all gone rather than kept as dead code.
- `Settings.welcomeSeen` in place of the spec's `modelVerified`. Nothing is
  verified any more; the only question left is whether this person has been told
  what the app is.
- The free-tier line is one component on three screens, and the spec's two
  sentences for the spent state became one: `freeTierStatus` returns "Free
  exports used", the spec's own words for it on Export, and Home, Saved and
  Settings say the same. Two phrasings of one fact is the app disagreeing with
  itself between screens.
- Welcome's headline is set in Spectral, the caption serif, which every other
  line of chrome is barred from using. It is the one screen with no video on it
  and the promise it makes is a promise about type.
- The Unlocked state is part of `/unlock` rather than a screen of its own. It is
  the same screen after the answer changed, and a route that can only be reached
  by having just paid is a route nobody can get back to.
- Unlock is reached from Home, Export, Saved, Settings, Welcome's Restore and now
  the dictionary's cap dialog, each passing where it came from, because "Back to
  export" is the only sensible button for somebody who was mid-export and the
  wrong one for everybody else.
- Home's empty state has no "Start with a video" line. Everything the spec asks
  of it is already there — the primary button is the empty state — and a third
  instruction under a title and a blurb, on a screen with one action, is a
  sentence nobody reads. Looked at on the phone with the projects hidden before
  deciding.
- Reduced motion reaches the chrome as well as the captions: the navigator's fade
  and the sheet's slide both go to `none`. On Android this is the same switch the
  platform uses to suppress them itself, so the app cannot be seen to be doing it
  — it is done because asking for motion the user turned off is wrong whether or
  not anyone can tell.

## Persistence

`entitlement.json` sits beside `settings.json` and holds what has been paid for:
`unlocked`, `unlockedAt`, `exportsUsed`, `firstRunAt`. Separate from settings
because a receipt and a dismissed coach card have nothing to do with each other,
and because deleting it is how a free tier gets reset for testing. Play is the
real record; this file is the app's memory of what Play last said.

A project owns everything it needs: `project.json`, `pipeline.json`, `audio.pcm`,
`envelope.f32`, `thumb.jpg`, `source.<ext>`, the video itself, and `export.mp4`
once there has been one. The export stays because Share needs a file to hand
over and the gallery copy is a `content://` URI the share sheet cannot always
take; the next export of that project overwrites it. `settings.json`
sits outside them all and holds what is true of the app rather than of a clip: the
coach card, and the style the next project starts in.

The video is copied in at pick time and the project never refers to anything
outside its own directory. The picker does not hand back the file in the gallery,
it hands back a copy in this app's cache, and a project pointing at that copy
opens on a black rectangle the moment the system reclaims the space. When the
video is missing anyway, the editor says so and offers to pick it again, because
the transcript is the expensive part and it is still there.

## Export

`src/export/run.ts` is the only caller of the burn-in module, the way
`src/asr` is the only caller of whisper. It builds the plan, starts the
foreground service, renders, publishes to the gallery, and spends a free export
— in that order, so a render that fails or is cancelled costs the user nothing.

The captions cross into native as a **draw list, not as instructions**.
`buildBurnPlan` runs the same `layoutCaptionFrame` the preview runs, with the
same Skia measurer, at the export's own pixel size, and writes positions, sizes,
colours and a baseline per word to a JSON file. Kotlin rasterises that with
`android.graphics`, which is the same Skia underneath, and decides nothing. The
five font files are the app's own: the module's Gradle build points its assets
directory at `assets/fonts`, so there is one copy in the repository and no way
for the two sides to set a word in a face the other never saw.

Entries are emitted only where the draw list changes, so a box highlight holding
still for a whole word is one entry rather than thirty, and the encoder reuses
the overlay texture it already uploaded. A karaoke fill changes every frame and
costs an entry every frame.

The pipeline is decoder → external texture → GL → the encoder's input surface:
no frame is ever decoded to the CPU and no pixel is read back. Rotation is baked
into the texture coordinates rather than left to an orientation hint, because a
hint asks the player to rotate and the players that ignore it would show a
sideways video with upright captions. Audio is copied across as compressed
samples: the user's voice was already right and a second lossy pass is damage
for nothing.

Preview and export are the same layout at two pixel sizes, which is not the same
as the same pixels. Measured on the A54: the caption's centre landed within 0.2
export pixels of the preview's, and its box came out 5 pixels narrower in a 576
wide frame — under one percent, and invisible. That difference is in the plan,
not in the burn-in, which can only draw the rectangle it is handed: hinted glyph
advances round differently at a canvas 1024 tall than at one 1077 tall. Laying
the export out at the preview's size instead would trade that for a blurry file.

The video is published with `expo-media-library`'s `Asset` and `Album` into a
Wordburn album, and the file is renamed to what the user is told it is called
before it is published, so the gallery and the share sheet agree. The permission
asked for is write-only and video-only, which on Android 13 and up is no
permission at all: verified on the A54 by revoking every media grant and
exporting anyway.

The function API that the docs still lead with — `createAssetAsync` and friends —
is deprecated in SDK 57 and throws at runtime rather than warning. It was found
by exporting on the phone, which is the only place it could have been found.

The .srt goes through MediaStore in the module, into Downloads. A subtitle file
is not media and no media library will take one. That path needs Android 10,
which is a gap: `minSdkVersion` is 26.

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
keeps the video view out of the render loop. The style sheet's four tiles
subscribe to the same clock at a twentieth of a second, because a thumbnail does
not need sixty frames and the preview does.

A style tile is a window, not a thumbnail: the canvas is the whole frame at tile
width and the tile shows the band the caption is in. Laying out into a short
canvas would put a lower third a third of the way up a letterbox and show a size
the export will never produce.

Settings carry a style too, written when the style sheet closes and read by
`createProject`. A creator has a look, not a look per clip.

## Editing

Every change to a project goes through `useProjectEditor`, which is what keeps
undo, the local emphasis recompute and the save policy in one file instead of in
every screen. Four doors, because four things may move: `edit` for text, where no
time may change; `editTiming` for the timing sheet, where the named words' times
may change and nothing else may; `editProject` for shift-all, which moves the
offset and may not touch a word at all; and `restyle`, which is not an undo step
at all. Each of the first three checks its own rule on the real transcript before
it writes.

`restyle` applies the change to every snapshot in the history as well as to the
present. A style is a property of the project rather than something that happened
to it, so undoing a word edit must not hand back the preset the user had already
abandoned. The style the user settles on is also written to `settings.json` when
the sheet closes, and a new project starts there. Undo is snapshots, not inverse operations: an edit already
returns a whole new project sharing the words it did not touch, so keeping the
old value costs pointers, while inverting a merge or a split is a chance to
restore something subtly different. Depth is capped at 100.

Writes are debounced by 500 ms and flushed when the app leaves the foreground or
the screen unmounts.

`timingDrift` runs on every text edit, on the phone, against the real
transcript: with the word count unchanged nothing may move at all, which is
invariant 1 exactly, and when a split, merge or delete has changed the count what
is checked instead is that no time was invented outside the span that was there.
A failure says so and refuses to write. `timingSpill` is its mirror on the timing
path, where time is allowed to move: the same words in the same order, no text
touched, nothing moved that was not named, and no overlap the action itself
introduced. Unit tests prove the same rules against fixtures; these are the
copies that run on the user's own words.

The editor's sheets share one `Sheet`, and its contents change rather than the
modal being swapped: unmounting one Android `Modal` in the same commit that
mounts another shows neither. A sheet's draft is a whole preview `Project` held
by the editor screen, so the overlay, the transcript and the loop all see what is
about to be applied without any of them learning what a draft is, and one visit
to a sheet is one undo step however many times a handle moved.

## The dictionary

`dictionary.json` sits beside `settings.json`, outside any project: a creator's
brand name is spelled the same way in every video they will ever make.

It reaches a transcript twice. Before the words exist, the spellings go to
whisper as an initial prompt, which biases the decoder toward writing them in the
first place — and a spelling the engine chose itself keeps the timing it heard,
where a repair afterwards merges words. After the words exist, `applyDictionary`
replaces what was heard with what the user spells. The prompt is read once at the
start of a run: a pass that picked up a new word halfway through would have
transcribed the first half without it.

**Prompt bias is measured and off.** Same clip, same build, same emulator, each
run repeated:

| prompt | words from a 0:53 clip |
|---|---|
| none | 173, complete |
| `Media, Zephyrine` | 80, better than half the clip gone |
| `This video mentions Media, Zephyrine.` | 166, one clause dropped |

The shape mattered more than the content: whisper takes the prompt as the
transcript that came *before* this audio, so a bare run of proper nouns reads as
a fragment of speech and the decoder carries on in that shape. A sentence nearly
fixed it. Nearly is not enough to lose a phrase of somebody's actual speech, so
`PROMPT_BIAS` in `src/asr/runner.ts` is false. The mechanism and the sentence
shape stay for a proper study across clips.

A decoy word in the prompt — `Zephyrine`, said nowhere in the clip — was not
hallucinated into either prompted transcript.

A word sheet hands the dictionary a half-written entry: the corrected text is the
spelling and what the engine heard is the first variant, so there is nothing to
type. The editor's chip counts what the dictionary would still change in this
transcript and applies it as one undo step, which is also how a project made
before an entry existed catches up.

## What the style sheet costs, and why it still costs it

Taken apart on the A54 with `dumpsys gfxinfo`, six seconds of playback per
reading, release builds, one control build per row:

| editor playing, 120 Hz panel | janky | 90th | 99th |
|---|---|---|---|
| style sheet closed | 4% | 8 ms | 13 ms |
| open, tiles drawing nothing | 13% | 16 ms | 25 ms |
| open, four canvases frozen | 17% | 17 ms | 28 ms |
| open, four canvases at 10 a second | 32% | 17 ms | 30 ms |
| open, four canvases at 20 a second — what ships | 37% | 20 ms | 36 ms |

Nine of the thirty-three points are the modal window and the shrunken stage,
before a tile draws anything. Four more are four Skia canvases merely existing.
The remaining twenty are the per-update work: a layout and a picture recording
per tile. The GPU is not involved at any point — it sits at 2 ms median, 7 ms at
the 99th, while `Slow UI thread` and `Slow issue draw commands` carry the count.

Two fixes were built and measured and neither shipped. **Staggering** the four
tiles onto different frames, on the theory that they were spiking together, made
it slightly worse: this is load, not a spike. **Halving the rate to ten a second**
moved 37% to 32% — but the same 20 Hz build measured 36.7% and 42.2% on two
different runs, so the ±5 point noise band is the whole size of the gain, and it
buys that by making a karaoke fill step visibly in the tile that exists to show
a karaoke fill travelling.

What is left is the one thing that would attack the real twenty points without
touching what the user sees: **one Skia canvas for the whole grid** instead of
four, with the cells as translated groups, so four picture recordings become one.
That is a rework of an accepted screen for an unmeasured payoff, so it is written
down rather than done.

The screen is not broken at 37%. Ninety percent of frames land inside 20 ms with
the sheet open, which is inside a 60 Hz budget; this is a 120 Hz panel and the
app is holding about 105 frames a second while animating five captions at once.

## The store

`src/policy/store.ts` is the only caller of expo-iap, the way `src/asr` is the
only caller of whisper. One non-consumable, `captions_unlock_v1`, in both stores.

The price is never composed in this app. `displayPrice` arrives from the store
already carrying the right symbol, separators and position for the account's
country; a number formatted here is wrong the moment somebody opens the app
abroad. When the store cannot be reached there is no price and the button reads
"Try again" instead of a guess.

A purchase does not come back from `requestPurchase`. It arrives on
`purchaseUpdatedListener`, so both listeners are attached before the sheet opens
and removed when it settles: a purchase that completes while nothing is listening
is a user who paid and saw nothing happen. Anything owned is acknowledged with
`finishTransaction({ isConsumable: false })` — Play refunds an unacknowledged
purchase after three days and there is no server here to do it later — and an
already-acknowledged purchase is left alone, because acknowledging twice is an
error.

Restore is the same query as the launch check: on both stores restoring is a
query, not a transaction. It never takes an unlock away. A tunnel, a Play
Services mid-update and a genuine refund are indistinguishable from inside the
app, and only one of them should cost somebody what they bought.

There is no receipt validation, because it would need a server this app does not
have and the thing being protected is a one-time unlock on the user's own phone.

This is the one part of the app that touches the network, which is why invariant
9 reads "after the model is on disk" rather than "never". Nothing here is ever
awaited on a path that leads to a caption: the launch check is fire and forget in
the root layout, and everywhere else the user asked for it and is watching a
spinner.

## Emphasis

Emphasis is data, picked in `emphasis.ts` from how the word was said: loudness
over the clip's speech median, how long it was held, the pause around it, plus
numbers, dictionary spellings and names. Every weight sits in one `EMPHASIS`
object. Stopwords and unverified low-confidence words are barred outright.
`autoEmphasis` is frozen at `ready` and re-picked only in the edited display unit
and one either side. Each preset decides how an emphasised word looks.

The word sheet carries the toggle and says which way the word was decided.
Emphasised words are bold in the transcript, and the style sheet's Editorial tile
animates the user's own line with its real picks.

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
- `expo-media-library`'s function API is deprecated in SDK 57 and throws when
  called, rather than warning. The class-based `Asset.create` and `Album` are
  what work. Nothing in a typecheck says so.
- Unmounting one `Modal` in the same commit that mounts another leaves Android
  showing neither, with no error anywhere. One sheet whose contents change.
- A `PanResponder` built in a `useMemo` keeps the callbacks of the render that
  built it. The hue strip applied its colour to whichever preset had been
  selected when the sheet opened, silently undoing the one chosen since. Every
  value a responder reads goes through a ref.
- `StyleSheet.absoluteFillObject` is not in this React Native's types. Spell the
  four edges out.
- `adb shell input swipe` at the wrong y proves nothing, and a screenshot of the
  result looks exactly like a component that will not scroll. Slice 10 "found"
  a broken toolbar ScrollView that way, wrote a `flex: 1` fix with a confident
  comment, and then a control build without the fix scrolled identically. The
  swipe had been missing the row by twenty-five pixels. Before believing a device
  test that says something is broken, make the same gesture prove it can succeed.
- Play Billing 8 stopped omitting a SKU it cannot find. `fetchProducts` returns a
  `Product` for it with the fields blank and `productStatusAndroid` saying why, so
  a `?? null` on `displayPrice` hands an empty string straight through. On the A54
  the button read "Unlock for " with nothing after it, because the app is not
  published. Check the price is a non-empty string, not that a product came back.
- Raising `minSdkVersion` past 28 makes AGP store DEX uncompressed. Nothing warns,
  and this app's 51 MB of DEX turned a 145 MB APK into a 179 MB one. It is a
  packaging change, not a payload change: the same contents deflate to 112 MB,
  which is nearer what a store delivers.
- React Native's Android alert calls `options.onDismiss` when a button closes the
  dialog, not only when the dialog is dismissed, so a promise wrapped around an
  alert cannot tell the two apart and latches onto whichever fires first. Put the
  work in the button's own callback and do not await an alert.

## Conventions

- `src/domain` has no platform imports and is unit tested first.
- Native modules expose one function and return a typed record.
- Every ASR call goes through one wrapper. Never call whisper.rn from a screen.
- Conventional commits. One vertical slice per pull request.
