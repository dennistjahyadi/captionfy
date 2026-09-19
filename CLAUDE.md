# Wordburn — working notes

Offline, on-device auto-captions for short vertical video. No account, no upload,
no server. README.md carries the Stage 0 spike; this file carries the product.

## Stack

Expo dev client, New Architecture. whisper.rn 0.7.4 (patched, see `patches/`)
with Silero VAD. Native Expo Modules for audio extraction and burn-in.
react-native-skia 2.6 for the overlay, expo-iap 5.6 for the one-time unlock.
Fonts: Be Vietnam Pro and Spectral, both OFL, in `assets/fonts/`.

**Builds are local Gradle, not EAS.** This file used to name EAS Build; nothing
was ever set up there and there is no `eas.json`. `run.sh` builds APKs onto a
device and `scripts/build-aab.sh` builds the bundle for Play. Cloud builds would
have to be taught to fetch the 82 MB of models, which are not in git, so the
local build stays until there is a reason to move.

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
background continuation, SRT import, and text behind the speaker (the draw list
reserves `layer` for it; build no segmentation now).

**The preset cap is lifted.** This file used to put "a fifth style preset" out
of scope. There are eight now, and the reason is in `references/`: four clips of
what the apps this one competes with actually ship. The look is the product for
a captions app, and the four v1 presets were a subtitle renderer's four looks
rather than a short-form video app's. See below for what changed and why it is
properties rather than presets.

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

11. Caption styles taken from the competition.
    **Done, and this one ran on the A54.** Four reference clips in `references/`
    — Captions, invideo, a Veed-style edit and a Submagic-style one — taken
    apart for what they do rather than what they look like, and the four
    mechanisms they share added to `StyleProps`: a line that reveals a word at a
    time, a per-word entrance, a shadow or glow instead of a stroke, and a card
    behind the block. Five presets arranged out of them — Spotlight, Word stack,
    Headline, Newsprint and Neon — and the picker's nine tiles moved into one
    Skia canvas.
    Designed in a headless harness first: the real `layoutCaptionFrame` over the
    real font metrics, drawn as SVG on a still and screenshotted. That is how
    the plate was caught breathing under the highlight, how the preset numbers
    were chosen, and how a white swatch on a white card was found.
    On the phone, release build, a real 145-word transcript: all nine tiles draw
    and animate, the glow renders, Spotlight's band puts its big word across the
    top with the sentence in the lower third, and a 0:41 clip exported at
    576 × 1024 in **8 seconds**. Two exports were checked frame by frame against
    what the preview drew. Spotlight's: the line builds word by word, the shadow
    is there, the banded word is where the preview put it. Neon's, which is the
    hardest case because it does three new things at once: the fill is caught
    mid-word — `YOU IMPR|OVE`, gold running into white — with the glow on every
    word and the line building `THAT` → `THAT CAN` → `THAT CAN HELP`. The Kotlin
    painter and the Skia overlay agree, `BlurMaskFilter` converted radius and
    all.
    Two free exports were spent proving this, so the counter on that phone is at
    one. Deleting `entitlement.json` from the debug build resets it.
    Frame timings are in the style-sheet section: **4.9% janky** playing with
    shadows on every word, **23.6%** with all nine tiles live, against the 37%
    slice 10 measured for four tiles in four canvases.

12. The free tier becomes a mark instead of a counter.
    **Built and run end to end, but on an emulator, not the A54.** `FREE_TIER` is
    `{ kind: 'watermark' }`: unlimited exports carrying a small wordmark that the
    unlock removes. The type and the `freeTierStatus` branch were already there
    and had been dead since slice 9; what was missing was anything that drew it.
    `layoutWatermark` is that, and it is a sibling of `layoutCaptionFrame` rather
    than part of it — see below for why.
    Verified on an Android 16 emulator, **release build**, on the 0:19 demo clip:
    Home reads "Free exports carry a small watermark" with no counter, Export
    reads "1080 × 1920 · 30 fps · with a watermark" and offers Save to gallery
    rather than a wall, and a 1080 × 1920 export rendered with the mark burned
    in. Measured on the exported frame against the preview, as fractions of the
    video's own rectangle: left 0.0611 against 0.0614, top 0.1375 against 0.1372,
    bottom 0.1490 against 0.1481, right 0.3000 against 0.3069. The one edge that
    moves is the right, by 7 px in a 1080 frame, which is the hinted advance
    rounding the Export section already documents for captions — it accumulates
    over the line, so it is larger for this wordmark than for the bare one it
    replaced and still under one percent.
    The mark sits inside `safeZoneUnion()` on all four sides and clears
    `CAPTION_INSET.upperMiddle`, both asserted in `watermark.test.ts` rather than
    left to the eye.
    **Those fractions predate a nudge.** Reviewed on 2026-09-18 against the
    editor's own safe-zone overlay, the mark was visibly reaching for the corner
    and missing it, so `TOP` went 0.135 → 0.125 and `LEFT` 0.06 → 0.05. The
    numbers above were measured before that and are the old position; what they
    still say, and the only thing they were there to say, is that the preview and
    the export agree to within the hinted-advance rounding. The corner clearance
    is now asserted in `watermark.test.ts` too, so it cannot drift back out into
    the middle of the band.
    **And they predate a redesign, twice over.** On 2026-09-19 the mark became a
    badge — the icon's three pills and "Captions by" over **Wordburn**, instead
    of one long line of type — and then the icon went from beside the words to
    above them, on the same day and for the same reason the stack happened at
    all: three tiers on one left edge read as one object, where a row of logo and
    type reads as two. `TOP` came down with it, 0.125 → 0.118, because a stack is
    taller than a row and the inset that read as pinned under two lines read as
    hanging under three. 0.110 is the floor: the safe zone is where the platforms
    start drawing.
    Both were designed in the same headless harness, over a real exported frame
    and a real near-white one, at 1:1, and then **run and measured on an Android
    16 emulator in a release build** — the first time any of it had been drawn by
    Skia or by the painter. The badge is 0.137 of the width against the 0.221 the
    row took and the 0.247 the single line took, its foot lands at 0.166 against
    `upperMiddle`'s 0.280, and its top at 0.118 is 0.008 under the safe line.
    Preview against export on the exported file, as fractions of each canvas:
    left 0.0500 against 0.0508, top 0.1182 against 0.1187, bottom 0.1661 against
    0.1659 — every one inside a single export pixel. The right edge is the one
    that moves, 0.1870 against 0.1738, and it is the hinted-advance rounding the
    Export section documents: see Known issues, because it is now bigger than
    that section claims.
    **Not run on the A54**, so by the line below this slice is not done.

Every slice runs as a release build on the Galaxy A54 before it is called done.

## Known issues

Four are left, and none of them can be closed from this machine.

- **The watermark has never run on the A54.** Slice 12 was verified end to end on
  an Android 16 emulator in a release build — the mark is burned into a real
  exported file and measured against the preview — but the phone was not
  connected, so by this file's own rule the slice is not done. What is unproven
  there is what the emulator cannot answer: how the mark reads on a real panel at
  arm's length, and whether the extra draws per repaint cost the burn-in anything
  measurable. They should not: it is three boxes and four text draws on a bitmap
  that is already being repainted, and only when the entry changes.
  **The badge of 2026-09-19 has run on an emulator and nowhere else.** Both
  renderers drew it in a release build on an Android 16 emulator — the pills, the
  stack, the shorter top inset — and the four fractions were taken again off a
  real exported file against the preview. Three of the four agree inside one
  export pixel. The fourth is the right edge, and it has grown: **0.0132 of the
  width, 14 px in a 1080 frame, where the Export section below says the hinted
  advances round to under one percent.** It is stable across luminance thresholds
  and it is the documented mechanism rather than a new one — a 512-wide preview
  canvas rounds a 30 px face's advances further from a 1080-wide export's than
  the 668-wide canvas did — but the sentence claiming "under one percent" is
  wrong for this mark and wants rewriting once the A54 has had its turn.
  Also unrun on any device: the store screenshots in `store/play-screenshots/`
  predate all of this and three of the eight now contradict the app. See
  `PLAY-CONSOLE.md`.

Closed in slice 11: the five new presets, the shadow, the plate and the
one-canvas tile grid all ran on the A54, in a release build, and both renderers
were checked against each other on an exported file. The blur conversion is
right, the shadow costs the overlay nothing measurable, and nine tiles in one
canvas beat the four the old grid drew in four.

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
- **The editor's stage is 38% of the screen, not 46%, and there is no controls
  row.** Measured on the A54 the old layout gave the transcript 28% of the
  screen, five rows, under a stage that was 44% black pillar either side of a
  9:16 clip. Now the scrubber is a hairline on the stage's own bottom edge with
  the transport in the corner over it, the timecode and undo/redo are in the
  bar, and a transcript row is 36 points with a hit slop back to `MIN_TOUCH`.
  The transcript has about 45% and ten rows; the clip previews at 191 points
  wide rather than 231, which is the cost. Two other layouts were drawn at the
  phone's size and turned down on 2026-09-18: a stage that crops to the caption
  band (captions 1.8× bigger, but the whole frame is a drag away and the window
  has to follow the style's position) and a video-first transcript sheet (the
  short-form convention, but it covers the lower third, where the captions are,
  and every editing surface here is already a sheet). `store/shots/editor.png`
  predates this and wants retaking.
- **Picking a video drops a curtain.** The picker copies the file into this
  app's cache before it hands control back, seconds on a long clip, and Home
  sat there fully tappable under a spinner on one button. `Curtain` covers the
  screen from the tap until Processing is up, takes every touch and the back
  button, and animates the product's own box highlight along "Getting your
  video ready" on the native driver, so it keeps moving while the JS thread is
  moving the file. It is a view in the screen rather than a `Modal`, because a
  modal is a window above every screen and would have covered Processing too;
  Home lifts it when it is next focused, not when it blurs, so it is never seen
  uncovering itself under the transition. The editor's "Choose the video
  again" uses the same one. Processing is untouched: its Cancel and its playing
  video are deliberate.
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
  itself between screens. That line is now "Free exports carry a small
  watermark" on all of them, and nothing says "used", because nothing is spent.
- **The free tier is a mark, not a counter, and the reason is that the counter
  walled off the wrong thing.** Three clean exports sounds generous until you ask
  what the trial is for. Checking that the captions match the audio does not need
  an export: the editor plays the real overlay through the real layout, free and
  forever, which is invariant 2 doing a second job nobody designed it for. What
  three rationed was finished files — and `runExport` charges again for every
  re-export, so a style tweak and a second save spent two of them. The mark trades
  a wall nobody could see coming for one they can. `exportsUsed` still counts and
  nothing reads it for gating; the free-tier test asserts that 99 exports still
  do not block, so a counter cannot grow back by accident.
- **The watermark is not part of `layoutCaptionFrame`.** It is `layoutWatermark`,
  its own pure function of a canvas and a measurer, in its own file. A mark takes
  no part in fitting, shrinking, revealing or emphasis, and threading an
  entitlement flag into the caption layout would put billing inside the one
  module allowed to know nothing but words and time. What it keeps is the part
  that matters: preview and export call the same pure function over the same
  injected measurer at their own two sizes, which is exactly how the captions
  hold invariant 2, so the mark holds it for the same reason and not a new one.
- **The mark is drawn on the editor's preview as well as into the file.** A
  watermark that appeared only at export is precisely the surprise invariant 5
  forbids, and the whole point of a free tier you can evaluate is that what you
  are looking at is what you will get. It is on `CaptionOverlay` rather than
  inside `CaptionElements`, so the style sheet's nine tiles do not each grow one:
  a tile is a hundred points tall and is answering a question about the preset.
  Settings' default-style screen does not get one either — it exports nothing.
- **Top-left, and the corners were all wrong.** `safeZoneUnion()` leaves the
  bottom 0.22 and the right 0.24 of a vertical frame under TikTok's action rail
  and the caption tray, so a mark in either bottom corner is invisible where it
  is meant to be seen and in the way while the user reviews. The band from 0.110
  (the union's top) to 0.280 (`CAPTION_INSET.upperMiddle`, the highest caption
  the style sheet can make) is the only place that is both on screen everywhere
  and not already spoken for. `top` at 0.12 would clash, which is one more reason
  `StylePicker` does not offer it. Bottom-left fails twice over: it is where the
  captions are, because `lowerThird` sits directly on top of that same 0.22.
  The convention the other apps follow — CapCut, Veed and Canva are all
  bottom-right — was weighed and turned down for exactly this. Their mark is
  mostly a nag aimed at the person who made the video, and being half under
  TikTok's rail is a price they accept; a line that says "Captions by Wordburn"
  is aimed at the viewer, and a credit nobody can read is not a credit.
- **The mark is pinned to the safe zone, not placed in the frame.** `TOP` and
  `LEFT` are 0.118 and 0.05, which is 0.008 of the height under the union's top
  and 0.010 of the width inside its left — 15 px and 11 px on a 1080 × 1920
  frame. They were 0.135 and 0.06, and that is a sixth of the band down and half
  a point in from the margin: near enough the corner to be reaching for it and
  far enough to miss, so the mark read as a label dropped into the shot rather
  than a bug on it. Looked at on 2026-09-18 with the editor's own safe-zone
  overlay, which is the picture that made it obvious; `TOP` came down again on
  2026-09-19, from 0.125, when the icon moved over the words and made the block
  a tier taller. The clearance is not zero on purpose — the union is a consensus
  of third-party measurements, so a platform a point more aggressive than it
  still has to miss the mark, and 0.110 is the floor rather than a suggestion.
- **It says "Captions by Wordburn", not "Wordburn", and the brand alone was the
  first version.** It failed the only test that matters: a viewer has no idea
  what made the video. A coined word in a corner explains nothing, and this one
  is misread in a specific direction — `Word-` is game-coded on app stores, which
  is the constraint the icon was designed against in the first place, so
  "Wordburn" over somebody's clip can read as a word game they were playing.
  Naming the job fixes that, carries the term a viewer would search, and reads as
  a credit rather than a stamp, which is the tone to want on a video whose maker
  is being invited to keep using the app.
- **It is stacked, and the icon is back.** "Captions by" in SemiBold over
  **Wordburn** in ExtraBold: the shape every platform's own mark uses, and the
  shape a viewer takes in at a glance rather than reading as a sentence. Set as
  one long line the same words were a caption somebody had left in the corner.
  The pills had lost a straight comparison against the single line, on the
  grounds that three bars with one highlighted only decode for somebody who
  already knows the brand. That argument does not survive the stack. It was
  asking the pills to *say* something, and beside a line that already says the
  whole thing they do the other job — they make the credit one object with an
  edge instead of two sentences of loose type, which is the whole of why a
  platform badge looks like a badge.
- **The icon sits above the words, not beside them.** Beside them it was a third
  column and the badge read as a picture with a caption next to it; over them it
  is the top tier of one block on one left edge, which is the same reason the
  words were stacked in the first place. It also stops the mark reaching
  rightward, where TikTok's rail starts at 0.760 and where a credit has nothing
  to gain. Sized at 1.15 of the brand rather than against the height of both
  lines, because the line it sits over is the one it has to agree with: at that
  ratio the widest pill lands about where "Captions by" ends. Bigger and the
  logo is the loudest thing in a credit, which is backwards.
- **Small, and every ratio was measured rather than chosen.** The brand at 0.0155
  of the canvas height is 29.8 px on a 1080 × 1920 frame and the credit at 0.64 of
  that is 19.1 px; the whole badge is 148 px across — 0.137 of the width, ending
  at 0.187 against the safe zone's 0.760 — and its foot lands at 0.166 against
  `upperMiddle`'s 0.280. It is **narrower** than both the row it replaced (0.221)
  and the single line before that (0.247), while the brand itself is half again
  as big as the line's, which is what stacking buys. It spends that on height,
  0.048 against the row's 0.023, and height is the cheap direction here: the band
  is 0.170 deep and nothing else is in it.
  Short-form plays full-screen, so a 1080-wide frame is about 1:1 on the phone
  and both lines are comfortably legible there — which is why the mock-ups were
  compared at 1:1 rather than shrunk to a feed that does not exist. Every number
  in this paragraph was read back off a real exported frame, not off the layout.
  The brand is white, the credit 88%, the muted pills 72% and the accent pill the
  icon's own yellow. The shadow is heavier than a caption's — a 0.2 sigma against
  a caption's 0.12 — because the mark is a third of a caption's size and the hard
  case is a white kitchen wall, where the halo is the only thing separating white
  type from the frame. On the near-white still this was designed over, the
  caption's shadow lost the credit line entirely.
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
- **Invariant 4 is about editing surfaces, and Export is not one.** The editor
  pauses its player when the screen loses focus. Every editing surface is a
  sheet over that screen and a sheet does not take the route's focus, so they
  are unaffected; Export, Saved, the dictionary and Settings are screens of
  their own. The player loops, so before this a clip carried on talking
  underneath them — you could finish an export and still be listening to the
  video over "Saved to gallery", for as long as you left it there. It does not
  start again on the way back: returning to a screen is not asking it to play.
- Reduced motion reaches the chrome as well as the captions: the navigator's fade
  and the sheet's slide both go to `none`. On Android this is the same switch the
  platform uses to suppress them itself, so the app cannot be seen to be doing it
  — it is done because asking for motion the user turned off is wrong whether or
  not anyone can tell. It now also turns off the per-word entrance, on the same
  one rule the emphasis rise already went through.
- **A tile draws Spotlight's big word in the block, where the preset puts it in
  a band of its own.** The two bands are most of a phone screen apart and a tile
  is a hundred points tall, so an honest tile shows one word or the other. A
  tile that answers "what does this look like" with half the answer is worse
  than one that shows the pieces together, and the real arrangement is in the
  preview above the sheet while the tile is being tapped.
- The preset tiles share one Skia canvas, each a translated and clipped group
  landing in the rectangle its own button reported through `onLayout`. The
  buttons are ordinary views and know nothing about time, so twenty redraws a
  second do not walk eight buttons' worth of views with them.
- Newsprint is the one preset that prints dark on light, so the word sitting on
  the highlight stays ink rather than taking the accent, and both the highlight
  and the big word wear a hard ink offset. That offset is not decoration: white
  is one of the six swatches and the card is white.

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
costs an entry every frame. A revealing preset costs entries while a word is
arriving and none once it has landed, which puts it between the two. The
comparison is over the whole entry, card included: a plate that changed while
the words did not would otherwise be dropped.

**The free tier's mark rides on the plan, not in the entries.** One
`watermark` object at the top of the file, absent entirely for anyone who has
paid. Repeating it in every entry would grow the JSON by a thousand copies of the
same thing and tell `CaptionPainter` nothing it did not know — worse, it would be
compared as part of the shape that dedupes entries, so a constant would be
carried through every comparison for nothing. The painter clears and repaints the
overlay bitmap whenever the entry changes and the encoder reuses it in between,
so drawing the mark last on each of those repaints is what puts it on every
frame. `buildBurnPlan` builds it with the same `layoutWatermark` the preview
called, over the same measurer, against the export's own canvas — the whole of
why it lands in the same place in both.

**The mark's icon crosses as boxes and its words as lines**, which is to say as
things both renderers already draw. A pill is the same `BoxDraw` a box highlight
is, so `Box` in the preview and `drawBox` in the painter take it unchanged, and
a line is the same shadow-then-glyphs pair a word is. Describing a logo in a
vocabulary of its own would have been a third drawing for the two sides to
disagree about, for a picture that is three rounded rectangles.

**A shadow's blur crosses as a sigma.** Skia's blur mask takes a Gaussian sigma
and `android.graphics`'s `BlurMaskFilter` takes a radius, converting it itself
with `radius * 0.57735 + 0.5`. The painter runs that backwards. Handing the
number straight over would have made every shadow in the exported file nearly
twice as soft as the one in the preview — invariant 2 broken in the one place
nobody would think to look, because both sides would have been "using the blur
from the plan".

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
keeps the video view out of the render loop. The style sheet's grid subscribes
to the same clock at a twentieth of a second, because a thumbnail does not need
sixty frames and the preview does.

A style tile is a window, not a thumbnail: the canvas is the whole frame at tile
width and the tile shows the band the caption is in. Laying out into a short
canvas would put a lower third a third of the way up a letterbox and show a size
the export will never produce. All eight windows are cut out of one canvas —
`CaptionElements` is the drawing without a canvas around it, and `CaptionOverlay`
is that plus the canvas and the view it sits in.

Settings carry a style too, written when the style sheet closes and read by
`createProject`. A creator has a look, not a look per clip.

Settings can also set it directly, at `/settings/style`, over `sample.ts`'s
standing line instead of a transcript: the same `StylePicker`, the same
`createFrameSource`, the same one layout. Before that screen the style had one
home and it was the editor's sheet, so Settings could only report it — a row
reading "Box highlight" that answered no tap, which is what a broken row looks
like, and no way at all to change it without a project open. The picker keeps
its Done for the sheet and drops it here, where the screen's own Back is the way
out; `CaptionLayer` and the safe zone moved out of the editor screen so both
previews draw through one of each.

## Caption styles, and what the references taught us

Four competitor clips sit in `references/`, **which is not in git** — they are
somebody else's footage and this repository keeps none. What survives the clone
is this section: what they do, why, and which property each thing became.

Watched frame by frame rather than admired, they turn out to share four
mechanisms and disagree only about arrangement — so those four are properties on `StyleProps` that any preset may
set, and the presets are arrangements of them. A ninth look should be a new
entry in `STYLE_PRESETS` and no new code.

- **`reveal: 'word'`.** The line builds as it is spoken; a word the viewer has
  not heard is not on screen. All four clips do this and one of them opens by
  showing a static block of subtitles as the thing that makes people scroll. The
  fit is decided against the *whole* line and only then is the visible prefix
  laid out, so the type does not shrink under the reader as the line fills.
- **`entrance`.** Every word arrives — scale, slide, fade — not only the
  emphasised one. `emphasis.riseFrom` stays and owns the big word's scale,
  because how a big word arrives is part of what a preset says about big words.
  The slide is folded into the emitted coordinates rather than carried as a new
  field, so a renderer that can draw a word at a place can draw one arriving.
- **`shadow`.** A soft shadow, or with no offset and `OWN_COLOR`, a glow. Every
  reference holds its type off the frame this way; a hard stroke reads as a
  caption a piece of software added. `blurRatio` is a Gaussian sigma.
- **`plate`.** One card behind the whole block. It is sized against the box
  *every* word could wear rather than the one wearing it, and off where the
  words settle rather than where they are mid-entrance — either mistake makes
  the card the only thing on screen the eye follows.

Two smaller ones came with them: `emphasis.band` puts the big word in a band of
its own, which is the whole shape of the loudest clip (a huge word across the
top, the sentence it came from small in the lower third), and `boxShadow` keeps
a pale highlight a visible shape on a light card.

### Where we are behind them, and where we are ahead

Four of the presets answer a clip each: Headline is the Captions one, Word stack
the invideo one, Spotlight the Veed-shaped one, Newsprint the plate. Two things
in those clips this app still cannot do, both named above: **letter spacing**
and a **condensed display face**.

What none of the four can do is the thing this app already had and was not using
hard enough. **Their emphasis is a setting; ours is acoustic.** invideo's own
settings panel is on screen in one of the clips — "Emphasized text", a font
colour and a background colour, applied to words the user marks. `emphasis.ts`
picks the big word from how it was *said*: loudness over the clip's speech
median, how long it was held, the pause around it. That is a thing a keyword
list cannot do, and **Neon** is the preset built to show it off — the word the
speaker leaned on is the word that lights up, without anybody tagging it.

Neon is also the one arrangement none of the four clips contains: a karaoke fill
under a glow, where the halo turns colour before the fill reaches it. The fill
and the reveal are theirs; the acoustic pick and the leading glow are not.

`OWN_COLOR` is a sentinel and the layout is the only thing that ever sees it: a
glow is a word bleeding its own colour, so it has to follow the swatch, and the
draw list that crosses into the export carries the resolved colour.

The four v1 presets were left exactly as they were. They are accepted, verified
designs and `reveal` is one property away for whoever wants to A/B them; what
this slice owed was better looks on offer, not a redesign of the ones already
signed off.

Two things the references do that this app still cannot: **letter spacing**,
which the small caps row of the Captions-style headline leans on, and a
**condensed display face**, which is most of why that headline reads as a poster.
Tracking would have to go through the measurer to survive invariant 2, and a
condensed face is another font file against the five megabytes of headroom the
APK has left. Both are real gaps and neither is guesswork to close.

### The harness

`layoutCaptionFrame` is pure and the fonts are on disk, so the design can be
looked at without a build: advance widths out of the TTFs with fontTools, the
real layout over a fake transcript, the draw list written out as SVG on a video
still, screenshotted headless. That is how the plate was caught breathing, how
the preset numbers were chosen, and how the white-swatch-on-a-white-card case
was found. It lives in the scratchpad rather than the repo because it is a
second renderer, and a second renderer that shipped would be something for the
export to drift against.

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

**Measured again in slice 11, and the answer is better than the table below.**
The last paragraph of this section describes one canvas for the whole grid as
the fix that would attack the real twenty points, and declines to build it for
an unmeasured payoff. Adding presets forced the question — nine canvases at the
old rate would have doubled the worst row — so it was built, and on the A54,
release build, six seconds of playback each:

| editor playing, 120 Hz panel | frames | janky | 50th | 90th | 99th |
|---|---|---|---|---|---|
| style sheet closed, four tiles, four canvases (slice 10) | — | 4% | — | 8 ms | 13 ms |
| style sheet **open**, four tiles, four canvases (slice 10) | — | 37% | 9 ms | 20 ms | 36 ms |
| style sheet closed, Spotlight, shadows on every word | 570 | **4.9%** | 6 ms | 8 ms | 15 ms |
| style sheet **open**, eight tiles, one canvas | 505 | **23.6%** | 11 ms | 18 ms | 26 ms |

Two things fall out of that. **A shadow costs the overlay nothing measurable** —
Spotlight draws every word twice, once through a blur mask, and closed-sheet
playback is the same 4-to-5% it was with a stroke. And **one canvas more than
paid for four extra tiles**: twice the presets at two thirds of the jank, with
the 99th percentile down from 36 ms to 26 ms. The remaining twenty-odd points
are the modal window and the shrunken stage, which the slice 10 table already
attributed nine of before a tile drew anything.

The table below stands as the history that justified the change.

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
- **A pushed screen does not stop the one underneath it.** `expo-video` pauses a
  player when the app is backgrounded, which is why nothing looked wrong for ten
  slices, but navigating within the app is not backgrounding: the editor stayed
  mounted under Export and its looping player kept playing. Pause on blur, and
  guard it — the cleanup also runs on unmount, where `useVideoPlayer` has
  already released the player and a `pause()` on a released shared object
  throws. `adb shell dumpsys audio` is how to see this without ears: the app's
  `AudioPlaybackConfiguration` reads `state:started` when it should not.
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
- **A release build is signed with the debug keystore until you stop it, and you
  cannot stop it by editing `build.gradle`.** AGP's template points the release
  build type at `signingConfigs.debug`, which is the same key on every React
  Native machine there has ever been, and Play refuses it. `android/` is not in
  git and every `prebuild` writes it again, so a hand edit lives until the next
  one. It has to be a config plugin: `plugins/with-release-signing.js`. Its
  anchors are AGP template text, and the template spells the assignment both
  `signingConfig signingConfigs.debug` and `signingConfig = signingConfigs.debug`
  depending on version — the plugin throws when an anchor stops matching, rather
  than quietly leaving the debug key in place.
- **A blur is a sigma on one side of the bridge and a radius on the other.**
  Skia's blur mask filter takes a Gaussian sigma; `BlurMaskFilter` takes a
  radius and converts it with `radius * 0.57735 + 0.5`. Nothing in either API
  says which it wants, and passing the plan's number to both would have made
  every exported shadow nearly twice as soft as the previewed one, with both
  sides able to claim they used the number they were given. `CaptionPainter`
  converts.
- **Nothing resizes under a `Modal` when the keyboard opens.** The manifest asks
  for `adjustResize` and React Native asks the dialog it puts a `Modal` in for it
  as well, and on the A54 neither window gave up a pixel: the IME came up over
  the whole entry sheet, title and buttons and all, not merely over the field
  being typed into. Every text field in this app is inside a sheet, so this was
  every text field in the app. `KeyboardAvoidingView` does not rescue it — with
  no `behavior` it renders a plain `View` and does nothing, and `padding`
  subtracts the keyboard from a frame that is the dialog's rather than the
  screen's. What does work is reading the height off `keyboardDidShow`, which
  React Native takes from the IME's own window insets and reports whether or not
  anything resized, and padding the dock by it. That is `useKeyboardInset`, and
  `Sheet` is its only caller.
- **`android/` holds a copy of the version, and a copy goes stale.** `expo
  prebuild` writes `versionName` and `versionCode` into `android/app/build.gradle`
  once; bumping `app.json` afterwards changes nothing, because `android/` is only
  regenerated when it is missing. A bundle sat on this disk carrying 0.0.1 while
  `app.json` said 1.0.0 — and `build-aab.sh` printed "version 1.0.0" on the way
  out, because it read the version it had asked for rather than the one it got.
  Nothing anywhere warns. `scripts/version.sh` syncs `build.gradle` from
  `app.json` before every Gradle run and then reads the version back out of the
  finished artifact: `aapt2 dump badging` for an APK, and for a bundle
  `scripts/aab-version.py`, because aapt2 cannot open an `.aab` at all and
  bundletool is not installed here. Saying the version back to yourself is not a
  check.

## Conventions

- `src/domain` has no platform imports and is unit tested first.
- Native modules expose one function and return a typed record.
- Every ASR call goes through one wrapper. Never call whisper.rn from a screen.
- Conventional commits. One vertical slice per pull request.
