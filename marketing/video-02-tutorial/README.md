# Video 02 — seven hooks, one tutorial

Seven organic TikToks. Each opens on its own hook and then plays **the same
tutorial body**: a walk through everything the app does. Seven uploads, one
variable. The body is the control and the hook is the experiment, so whichever
of the seven holds viewers past three seconds says something about the hook and
nothing else — and it is *literally* the only variable, because the body is
rendered once and joined to each hook without a second encode, and the
self-check hashes every body frame in all seven files to prove they match.

**Six claims, seven files.** `pay-once` and `pay-once-b` are the same claim over
the same footage, worded two ways — the only pair here. Everything else is one
hook per idea.

**Status: voiced, phase 3.** Built 2026-09-20 against app **1.0.3**, then cut to
a real voice on the same day.

| | where | voice | length |
|---|---|---|---|
| Silent cut | `out/` | — | 47.5 s each |
| Voiced cut | `out/voiced/` | default, `body2_slow.mp3` | 65.2–67.0 s, 7 hooks |
| **Voiced cut** | `out/voiced-hale/` | `hale`, `hale_body.mp3` | 56.4–64.1 s, 7 hooks |

**All three live side by side on purpose.** Each render names its own
`--outdir`, so nothing overwrites anything: the silent cut is still there to
compare the first voiced one against, and the two voices are still there to
compare with each other.

## Two voices, one video

A second read of the same script is not a second project. The framing, the safe
box, the nine beats and their on-screen labels, the segments, the pointers and
the sources are all the same video, so a folder per voice would copy three
hundred lines of config to change a filename.

A voice is an **overlay** instead. `config.json → voices.<id>` replaces whatever
it names — the body recording, the hook set, the output directory — and
`timings.json → voices.<id>` carries that voice's own measurements.
`beats.js → resolveVoice` is the one place that merges them, and every script
and composition goes through it. The default voice is the bare top level, so a
reader who has never heard of this sees the file it always was.

```sh
node ../pipeline/split-voice.mjs --voice=hale     # measure, into timings.voices.hale
node ../pipeline/render.mjs      --voice=hale     # → out/voiced-hale/
node ../pipeline/selfcheck.mjs   --phase=3 --voice=hale
node ../pipeline/storyboard.mjs  --voice=hale
```

The compositions take `voice` as a prop and turn it into a duration through
`calculateMetadata`, because a body that is 62 s in one voice and 51 s in
another cannot be a module constant.

### What differs between them, and what does not

**The body is the same nine lines, word for word.** `hale_body.mp3` reads the
script `body2_slow.mp3` reads; it is simply a different voice and a fifth
faster — 51.49 s against 61.96. So no label on screen changed, and the only
thing the hale body needed was its own nine measurements.

**The hooks are not a re-read.** They are seven new lines on seven new claims,
so they have their own ids, titles and footage. They also break this project's
own hook doctrine: they run **4.36 s to 12.04 s**, where the first set ran 2.59
to 4.44, and the README's rule is that a hook has resolved by 3 s or it has not.
Two of these are still talking at twelve seconds.

They are used at full length anyway. The alternative is clipping a recorded
sentence mid-word, and a hook that stops halfway through its own claim is worse
than a long one. What it costs is that `private` opens on 12.5 s before the body
starts. **If the 3-second hold comes back poor on these, the fix is a shorter
read, not a shorter picture.**

**Every hale hook is `kind: phone`** — a device on solid black. The first set had
two `export` hooks that play the app's finished file full-bleed, and those are
the only two frames in either cut that are not black.

## The voiced cut, and what the voice changed

Three things stop being decisions this project makes and start being
measurements of a recording.

**Beat lengths come from the audio.** `split-voice.mjs` finds where the one body
recording divides and writes the nine lengths into `timings.json`. The beats are
cut to the read, never the other way round, and `pad` is **0**: the measured
pieces already tile the whole file, so the 0.8 s of room `beats.js` adds to a
*planned* length would be 0.8 s of drift per beat, compounding to seven seconds
by the close.

**Cuts are found by counting sentences, not by guessing at times.** The close
holds two sentences, so the recording has ten sentence breaks for nine beats.
The longest that-many pauses are the breaks, and a beat ends at the break after
its last sentence. Two earlier versions got this wrong in opposite directions:
taking the N−1 longest pauses put a cut inside the close, and taking the pause
nearest each expected time let a 0.26 s comma outrank a 0.46 s full stop two
seconds away. The word count survives only as the cross-check that says when a
cut has landed somewhere the script cannot explain.

**Every hook is its own length.** The seven reads run 2.59 s to 4.44 s, so one
shared number would leave two seconds of silence under one hook and clip
another. `tutorial-hook` computes its duration from the prop through
`calculateMetadata`, and the seven finished videos differ by up to 1.9 s. That is
fine: the body they share is identical, and that is the half the test controls.

Measured on the finished file, every beat boundary lands inside a pause between
sentences, about 0.1 s past its middle, which is frame rounding. The hook-to-body
cut lands in the gap after the hook's last word.

## The recordings

| voice | file | |
|---|---|---|
| default | `input/voice/body2_slow.mp3` | 61.96 s, one generation, ten sentences |
| default | `input/voice/hook_<id>.mp3` | seven generations, 2.59–4.44 s |
| `hale` | `input/voice/hale_body.mp3` | 51.49 s, the same ten sentences, a fifth faster |
| `hale` | `input/voice/hale_hook_<id>.mp3` | seven generations, 4.36–12.04 s |

Both sets are staged **by hook id**, not by the number they arrived with.
`references/hale/hale_hook_4.mp3` becomes `input/voice/hale_hook_look.mp3`,
because a positional name moves the moment a hook is inserted in the middle —
which already happened once, when `pay-once-b` was added to the default set.

**The hooks were recorded against an earlier script than the last two rewrites,
and what they say was read back rather than assumed.** There is no
speech-to-text on this machine, so the seven were concatenated into one file,
wrapped in a black 1080 × 1920 video, pushed to the emulator and transcribed by
Wordburn itself. That is how `config.json`'s hook lines and titles were set to
the audio: a title that disagrees with the voice under it is the one defect
nobody notices until it is posted.

The one word that needed a judgement is `emphasis`, which comes back as "your
captions **here** which word you leaned on". That is the homophone, not a second
reading — there is no sentence in which "captions here, which word" parses — so
the line is written `hear`. It is the only word in the seven that was not simply
read off the transcript, and it is worth a listen before posting.

## The seven hooks

| # | id | s | on screen | under it |
|---|---|---|---|---|
| 1 | `outcome` | 3.04 | these captions were made on a phone | the export, full-bleed from 7.2 s |
| 2 | `airplane` | 3.53 | airplane mode on. can it still caption this? | Processing, the aeroplane in the status bar ringed |
| 3 | `pay-once` | 3.69 | most caption apps bill you every month. | the Unlock screen: "Buy it once. Keep it forever." |
| 3b | `pay-once-b` | 3.30 | what if captions only cost you once? | the same Unlock screen, same first frame |
| 4 | `emphasis` | 4.00 | your captions hear which word you leaned on | the export from 13.5 s, with a waveform under it |
| 5 | `no-account` | 4.89 | no account. no upload. no server. | Home, with no sign-in anywhere on it |
| 6 | `styles` | 4.32 | eighteen caption styles, on your own words | the grid, every tile animating the real transcript |

**3 and 3b are a pair and are read as one.** Same footage, same opening frame,
one variable: whether the hook names the subscription as the problem or asks for
the alternative. A gap between those two is about wording; a gap between either
of them and `airplane` or `styles` is about which claim is being made. Both were
recorded, so both ship — but they are one slot in the schedule below, not two,
or the pair spends two of the seven days answering a smaller question than the
other five.

**Hook 4 is the weak one and the config says so.** The claim is true —
`emphasis.ts` picks the word from loudness, how long it was held and the pause
around it — but Focus, the default preset, scales an emphasised word by only
**1.12**, and at half scale that is nearly invisible. What the eye follows is
the blue mark travelling with the voice, which is a different mechanism. The
waveform is drawn here, not by the app. The spare is `fix`, whose evidence is a
dotted word and a chip that disappears, and which reads at any scale.

### The seven hale hooks

| # | id | s | on screen | under it |
|---|---|---|---|---|
| 1 | `hours` | 10.90 | captions on your phone. nothing uploaded. | picking a clip, then Processing with the aeroplane ringed |
| 2 | `engagement` | 5.78 | bad captions are killing your engagement | the grid of eighteen looks, animating the real transcript |
| 3 | `chore` | 4.81 | captions shouldn't be a chore | a dotted word, one tap, the chip gone |
| 4 | `look` | 10.98 | the look you want, without the subscription | the style grid, then the Unlock screen |
| 5 | `taps` | 9.78 | a few taps, not an editing suite | the editor playing, then a timing handle dragged |
| 6 | `private` | 12.49 | your footage never leaves the phone | the Airplane tile switched on, then transcribing offline |
| 7 | `own-it` | 6.80 | pay once. own it forever. | Home and its free-tier line, then the Unlock screen |

**One line in the recording overclaims and the title deliberately does not
repeat it.** `private` says "the only captioning app that works entirely
offline". Nothing in this repository has surveyed the category, so that is the
recording's wording rather than a checked claim — it is the one sentence in the
fourteen that a complaint could reach. The title under it says what is provable
instead.

## The body

Nine beats, 62.03 s in the default voice and 51.49 s in `hale`, shared by all
seven files of each. Every beat is the whole screen inside a
device, one short lowercase label above it, and a full sentence in the voice.
The label is what a muted viewer reads; the sentence is what makes it make
sense.

| # | id | on screen | s |
|---|---|---|---|
| 1 | `pick` | **this is wordburn** · kicker "how it works" | 5.87 |
| 2 | `transcribe` | **nothing is uploaded** | 5.83 |
| 3 | `editor` | **timed to the voice** | 7.83 |
| 4 | `fix` | **it marks what to check** | 7.40 |
| 5 | `timing` | **move any word** | 6.77 |
| 6 | `styles` | **one look, every client** | 6.80 |
| 7 | `dictionary` | **brand names, spelled right** | 6.77 |
| 8 | `export` | **done in seconds** | 6.00 |
| 9 | `close` | the export running, with "Get it on Google Play" over it | 8.77 |

The order is the order somebody would actually use the app, which is the whole
of the storytelling: pick, transcribe, read, fix, time, style, teach, export.
Beat 9 is an overlay on a running shot rather than a card, because a static logo
is a fifteenth of the runtime doing nothing and completion is what gets
distributed.

## Framing: the whole screen, at half size, on black

The ground is **true black**, not the app's ink with a warm lift under the
middle. That gradient is video 01's and it belongs there — a paid product film
is mostly one considered colour. A tutorial is a phone standing on a ground for
most of its length, and a gradient behind the phone reads as a studio backdrop,
which is the manufactured look organic TikTok punishes. Black also meets the
platform's own chrome without a seam and is not lit at all on the panels most
of this will be watched on. `Ground` keeps both modes, so video 01 is untouched.


Every app shot is the **entire 1080 × 2400 screen inside a device frame**,
nothing cropped. An earlier cut showed a band of the screen per beat at close to
native scale, on the argument that an advertisement for a typography feature
must not shrink the typography. That is right about type and wrong about
tutorials: a viewer who has never seen the app cannot tell a band from a whole
screen, so every cut looked like a different app.

The scale is **0.5**, not 0.6. At 0.6 the device's foot landed at y 1898, and
TikTok's caption covers everything below 1498 — which is exactly where the word
sheet, the timing sheet and the dictionary dock. At 0.5 the foot is at 1603 and
the only thing crossing is the bottom bezel and Android's gesture bar.

**Legibility of the app's own text is not the goal and cannot be.** At any scale
that fits, 16sp is about a millimetre tall on a viewer's phone. The frame
carries the *shape* of what is happening — a sheet rising, a chip disappearing,
a grid of looks, a progress bar filling — and the title and the voice carry the
meaning.

## The two rules, inherited

1. **Every caption on screen came out of the app.** The body is emulator
   recordings of the real app and one real export the app made during the
   `saving` shot. The self-check greps `../pipeline/`, `src/tutorial/` and
   `src/parts/` for whisper, `.srt`, the `subtitles` filter and the ad project's
   `CaptionTrack`.
2. **No third-party footage, no faces.** Everything is the app's own export,
   recordings of the app, and the app's own typefaces.

## Running it

```sh
cd marketing/video-02-tutorial

./run.sh --emulator --release            # (repo root) build 1.0.3 onto a device
node ../pipeline/capture.mjs             # → input/app/*.mp4, from shots.json
node ../pipeline/pull-export.mjs         # → input/app/export.mp4
node ../pipeline/voiceover.mjs           # → out/voiceover_script.md, the text to record

# once the recordings are in input/voice/
node ../pipeline/split-voice.mjs --write # → timings.json, and body_1..9.mp3 to listen to
node ../pipeline/render.mjs --outdir=out/voiced
node ../pipeline/storyboard.mjs --outdir=out/voiced
node ../pipeline/selfcheck.mjs --phase=3 --outdir=out/voiced
```

`--hook=<id>` renders one; `--only=body` or `--only=hooks` renders half.
`capture.mjs --probe` screenshots the device so coordinates can be re-read —
`shots.json → where` names every coordinate this video depends on.

## Where things live

| Here | There |
|---|---|
| `config.json` — hooks, beats, framing, safe box, pointers | `../remotion/src/tutorial/` — `Hook`, `Body`, `Tutorial`, `Segments`, `Storyboard` |
| `timings.json` — measured beat and hook lengths | `../remotion/src/parts/` — `PhoneFrame`, `Title`, `ExportShot`, `Pointer`, `Sheet` |
| `shots.json`, `app-shots.json` | `../remotion/public/tutorial/` — the staged copy Remotion serves |
| `input/`, `out/` — media in and out, both out of git | `../pipeline/` — capture, pull, sync, split-voice, render, storyboard, check, voice script |

## What this build taught us

- **`run.sh --emulator` booted a *second* emulator.** Two AVDs were defined, it
  picked the other one, built onto it and failed the install for want of disk —
  while the device every coordinate here is calibrated for sat idle beside it.
  Pass the AVD name, or `WORDBURN_AVD`, whenever more than one exists.
- **Clearing app data brings back the permission dialog and the coach card.**
  The notification prompt blocks Processing; `pm grant
  android.permission.POST_NOTIFICATIONS` once. The "Dotted words" card covers a
  third of the transcript, and its "Show me" is at **(168, 2234)** — not at the
  coordinate a screenshot viewer reports, which is scaled.
- **The gallery is not app data.** Wiping the app leaves every previous export in
  the picker, sorted in front of the source clips. Delete them from MediaStore
  before the `pick` shot, and note that a file pushed with `adb push` is not
  indexed until `content call --uri content://media/external --method scan_file`.
- **A stray drag set two things nobody asked for.** The style shot's position
  step was a drag inside the position frame; at the scroll position it actually
  landed on, it crossed the hue strip and the size row and left the project and
  `settings.json` on a cyan highlight at size S. Neither has an undo in the
  sheet. The step is now two taps, Upper then Lower.
- **The style sheet's teardown swipe has to start inside the scroll view.** A
  swipe from y 1250 is on the sheet's header and scrolls nothing, so the tap
  after it lands on whatever is under the *scrolled* position. That left the app
  in the wrong preset twice across two sessions.
- **`adb pull` fails occasionally and takes the run with it.** Re-running the
  affected shots is the fix; nothing is wrong with the recording.
- **The export is 24 s on this emulator, not 54.**
- **`execFileSync` cannot read silencedetect.** ffmpeg reports silences on
  stderr and exits 0, so `spawnSync` with stderr read by name is the only way;
  asking `execFileSync` for it returns null and fails a line later with a type
  error naming nothing.
- **A container's duration is not the picture's length.** Once there is an AAC
  track the container reports whichever stream is longer, and the encoder pads
  its last packet — every voiced file read about 0.10 s over the timeline and
  failed a check that nothing was wrong with. The self-check counts video frames
  now.

## Post copy, first draft

Lowercase, one per hook, the app named once and late. Numbers live here and not
on screen. One upload a day for six days, same time each day, so the six are
comparable — and 3 and 3b **share day 3**, one of them a week later, because
they are one claim and posting both in the run would make the week a test of
wording rather than of which claim lands.

1. **outcome** — "made these on my phone. no laptop, no upload, no account. the whole speech model is inside the app so it works in airplane mode. wordburn, android only."
2. **airplane** — "turned the internet off and captioned a video anyway. the model is 82mb and it lives in the app. wordburn, android."
3. **pay-once** / **pay-once-b** — "captions subscriptions run about $19–25 a month now. built wordburn instead: one payment, no credits, no monthly cap. android."
4. **emphasis** — "every captions app makes you pick which word gets highlighted. this one listens for it. no keyword list. wordburn, android."
5. **no-account** — "no account. no upload. no server. your video never leaves the phone. wordburn, android."
6. **styles** — "eighteen caption styles and every one animates your own words live while you pick. wordburn, android."

The pair shares its copy as well as its day. Same post text under both is what
makes the second one readable as a hook test — if the caption changes too, a
difference between them says nothing about the three seconds at the front.

What to read a week later, per hook: **3-second hold**, **completion**, and
**profile taps**. The body is identical, so a spread in those three numbers is
the hook.

## Before posting anything

- **The Play listing is not live.** The close beat says "Get it on Google Play"
  and the voice says the same. Nothing here may be posted until that page
  exists.
- **Google Play only, and not just as a launch choice.** iOS has never been
  built in this project, so there is no iPhone version to send anyone to. When
  there is, `config.cta` and the close line are the two places that change.
- **The voice is synthetic**, so the AI-generated-content toggle goes on at
  upload.
- **The recordings are of an emulator.** Status bar, fonts and corner radii are
  not a Galaxy's. For organic posts that is fine.
- **The Saved screen carries the feedback card** and **the Unlock screen's price
  button spins**, because the product is in no Play Console. Both are real UI
  and both will change the day the listing goes live.
- **65–67 seconds is long** for the format, and it is the accepted cost of
  explaining nine features in sentences a stranger can follow. If completion is
  under 50%, the short cut is `fix`, `timing` and `dictionary` dropped — a list
  edit in `config.json`, a re-recorded body, and a re-run of `split-voice.mjs`.
- **Look at `out/voiced/storyboard.png` and `out/selfcheck/` first.** The
  self-check can prove the seven bodies are identical, the safe box is right and no
  caption was drawn here; it cannot tell whether a line reads well over a shot.

## The title is centred on the frame, not on the safe box

The organic safe box is asymmetric on purpose — it starts at x 60 and stops at
x 960, because TikTok's action rail eats the right-hand side. Its own centre is
therefore **x 510**, and every title in every cut before this one was centred in
the box rather than in the frame: 30 px left of the 1080-wide frame, and 30 px
left of the phone underneath it, which is centred on 540.

On a still it reads as a mistake, because it is one — the device and the label
over it are one object and have to share an axis. `Title` now centres on the
frame and clamps its half-width to the nearer margin, so the line keeps the
frame's axis and still cannot cross either edge of the box, which is the whole
job the box was doing. It costs 60 px of measure: the right-hand margin,
mirrored onto the left.

**`out/voiced/` predates this fix and `out/voiced-hale/` has it.** Nothing was
re-rendered, because nothing already delivered may be overwritten — so the two
cuts differ by those 30 px until the first one is rebuilt.

## The ring round the aeroplane

Reported as "the bar that shows airplane mode is cropped", and it was — though
the status bar was never the thing being cut.

`pointers.airplane` was `r: 70` about `(941, 61)`. The aeroplane glyph really
sits at **x 929–959, y 52–73** — 31 × 22 px, centred **(944, 62.5)** — and the
battery is the next glyph along at **x 985–1004**. A ring of 70 therefore spans
x 871–1011 and y −9 to 131: it drew a yellow stroke straight through the
battery, and it began **nine pixels above the top of the screen**, so its top
arc left the recording, crossed the bezel and was cut flat by the frame's edge.
Two glyphs inside a hoop that runs off the phone reads as a bar with its top
sliced off.

It is now `r: 32` about `(944, 62)`. The stroke is 4 frame px — 8 device px —
so the outer edge is r + 4: **980 against the battery at 985**, and **26 against
the top of the screen at 0**. Measured back off the rendered frame: ring outer
x 908–978, y 26–96, centre (943, 61) against the glyph's (944, 62.5).

**`devicePoint` was also two pixels out.** The body is a content-box with
`padding: BEZEL` *and* a 2 px border, so the screen's corner is `BORDER + BEZEL`
in from where the body is placed, not `BEZEL`. Two pixels is invisible under a
ring of seventy and obvious under a ring of thirty-two. `BORDER` is a named
constant now and `devicePoint` adds it.

**A crop that does not fit is moved, not refused.** The first attempt at this
fix put the centre at 964 and made it worse. The measurement behind it was
`crop=200:100:900:10` on a 1080-wide frame — 900 + 200 overruns the right edge,
and ffmpeg silently clamps x to 880 rather than failing, so every run came back
20 px right of where it really was. Measure the full width and let the numbers
be absolute, or keep the window inside the frame.

## Known, not fixed: the phone's bezel is not symmetric

`BODY` is `SCREEN + BEZEL * 2`, and the body div then *also* has
`padding: BEZEL` with `boxSizing: 'content-box'`. The bezel is counted twice on
the right and bottom and once on the left and top, so the body is 600 px wide
around a 540 px screen: **16 px of bezel on the left and 44 px on the right**,
and the whole phone sits 16 px right of the frame's centre.

It has been that way in every cut of this video and nobody has called it, which
is why it is written down rather than changed — fixing it moves the phone in
every frame. The fix is small: give the div `SCREEN.width`/`SCREEN.height`
rather than `BODY`, and make `BODY` the true outer size,
`SCREEN + (BEZEL + BORDER) * 2` = 572, which puts `PHONE_LEFT` at 254 and the
screen at 270–810, centred on 540.

## The third cut: motion, subtitles, sound

The second voiced cut was a phone standing still for a minute while a voice
talked over it. Everything below is what changed, and each of them is a thing
the flat version could not do.

### It leans in, and it always shows the whole screen first

`Focus` moves the camera in on the one control the sentence is about, holds,
and pulls back before the cut. **Nothing is ever cropped that has not been
shown whole first**, which is what the second cut's never-crop rule was really
protecting — a viewer who has not seen the app cannot tell a band of a screen
from a screen, but they can follow a move.

**The regions are in the recording's own 1080 × 2400 pixels, not in frame
pixels.** That is the part that keeps the app's spacing honest: a rectangle in
frame coordinates has to be re-derived every time the framing moves and drifts
off the control it was drawn around, where one in device pixels is read
straight off the app. Content runs x 40–1040 on every screen here, so a
full-width region is 36–1044 and a focus box round a card is the card's own
bounds plus the app's own margin.

The headline and the step ticks **stand down while the move is happening** —
they live above the phone's head and the phone's head rises when it leans in.
Fading them beat shrinking the move: by then the headline has been read and the
subtitle is carrying the sentence.

### Headlines assemble; they do not fade in

`Headline` springs the words in two frames apart, so the line builds in the half
second a thumb takes to decide. Words rather than letters — a per-letter reveal
at this size is a title sequence. An accent rule draws under the last word, and
`Steps` shows nine ticks with the current one lit, because at twenty seconds a
viewer cannot otherwise tell whether there are two more of these or twenty.

### Subtitles, and what they are not

**They are this video's subtitles, not Wordburn's output**, and rule 1 survives
intact. The words are the `vo` lines already in `config.json` — the script —
and `captions.json` says only *when* each is spoken. The alignment that produced
those times ran once, offline, outside this repository; nothing in
`../pipeline/` turns audio into words, which is what the self-check greps for.
Its report now says this in as many words rather than claiming every caption on
screen came from the app.

The whole cue is present from the frame it appears and the accent travels across
it, rather than the line building word by word: a line that builds makes the
reader wait for the voice, where one already there lets the eye run ahead —
which is the entire reason captions raise completion.

A scrim under them was argued against and then added. The argument against was
that the ground is solid black and a plate over black reads as a subtitle track
somebody left on. That was about the ground and forgot the phone: the block
lands over the app's own transcript, sheet or waveform for a third of the
runtime, and there the competition is not brightness but that the app's words
are the same shape as the subtitle's. The band is 0.86 in the middle and gone at
both edges, so it has no edge of its own to read as furniture.

### Sound, and why none of it is licensed

`make-sfx.mjs` generates every sound with ffmpeg from tones and filtered noise.
`STORE-ASSETS.md` requires a source and a commercial licence in `CREDITS.md`
for any third-party asset, which is the same rule that keeps music and stock
footage out of these videos; a free-sound pack whose licence nobody has read is
exactly what that rule exists to stop. Generated sounds raise no licence
question and `CREDITS.md` stays empty.

**Nothing repeats twice in a row.** The palette holds three cut sounds, two
move-ins, two marks and two openers, and `Sfx` walks each list with a stride of
two, so consecutive beats are never neighbours in the list. Over nine beats each
cut sound is used three times, spread out, instead of one of them nine times.
Measured on the finished file by subtracting the voice — the voice is silent at
every beat boundary, so the residual there is the effect alone:

| beats | residual RMS at the cut |
|---|---|
| 2, 5, 8 | 997.5 · 997.5 · 997.7 |
| 3, 6, 9 | 918.0 · 918.0 · 917.4 |
| 4, 7 | 1098.3 · 1099.3 |

Three levels, cycling in threes, no two adjacent the same.

Everything sits between 0.16 and 0.3 of full, so it registers as the cut having
weight rather than as an effect having happened — the finished file is
**−19.1 dB mean, −3.7 dB peak**, which leaves the headroom an upload wants. The
riser under the close is used **once in the whole video**, which is what lets it
mean "this is the end".

### Working on it

```sh
cd marketing/remotion && npx remotion studio --port 3100
```

`tutorial-body` and `tutorial-hook` both take `voice` as an input prop — set it
to `hale` in the studio's props panel, or the default voice renders.

## Fourth pass: the glitch, the close, the sound, the hand-offs

**The accent box outlived its target.** `pick` held the focus on the New video
button from 1.1 s to 3.1 s into the segment — but the system picker starts
sliding over that button at **2.0 s**, so for most of a second the box was
drawn around a sheet, pointing at nothing. It is 0.35 to 1.45 now, landing at
0.9 and faded by 1.75. **A focus window has to be checked against what the
recording is doing, not just against how long the line is**; every other beat's
window was checked the same way and the rest hold their targets.

**The close is black.** It used to play the app's finished export full-bleed,
and that stopped working the moment this cut grew subtitles of its own: the
export has Wordburn's captions burned into it — that is the whole point of it —
so the last beat showed the app's captions and the video's subtitles at once, in
two typefaces. Two sets of captions on a captions ad reads as a bug, because it
is one. `source` is `black`, and the mark, the name and the store line have the
frame to themselves.

**No sound is used twice in one video.** The previous palette had three cut
sounds rotating over nine beats, so each was heard three times and the ear found
the loop. `make-sfx.mjs` now generates **53 distinct files** — nine cuts, twelve
of each move kind, twelve marks, seven openers, one riser — and every call site
takes a running index. The body's moves take indices 0–9 and a hook's take
10–11, disjoint on purpose: the two are joined into one file, and the body is
rendered once for all seven hooks so it cannot continue a count that differs per
hook.

They are still a family. The cuts walk *down* a pentatonic series as the
tutorial proceeds and the marks walk *up*, so a beat's cut and its mark move
apart rather than together, and none of the 53 is a surprise. Measured on the
finished body, at the nine beat boundaries where the voice is silent:

```
4.45 s  1092.3      21.40 s  1167.9      32.62 s  1228.7
9.22 s  1115.7      26.81 s  1197.5      38.17 s  1261.5
15.21 s 1141.3                           43.47 s  1298.3
```

Eight distinct values for eight cuts — no repeat, and the series climbs because
the pitches fall.

**It steps rather than jumps.** Two changes together. Each beat that leads
somewhere now **presses the control it has been holding** a beat before the
hand-off — the ring contracts onto it and ripples, riding the move's own
transform so it lands on the control rather than beside it. And the next beat
**fades up over this one** across eight frames instead of replacing it, so the
new screen arrives as the consequence of a tap instead of as a new shot. It
costs nothing in length: the beats start where they started, each merely keeps
drawing for eight frames underneath its successor.

`transcribe` has no tap, because nothing is tapped there — the ring on the
aeroplane is the point of that beat — and neither does `close`.

## Not fixed: the status bar reads small, and it is the recording

Reported twice as cropped. It is measurably not being cropped **by anything
here**. Against the source recording scaled to the same size, the rendered
status bar band is pixel-identical:

| | |
|---|---|
| max difference | 41 of 255 |
| mean difference | 0.42 |
| pixels differing by more than 60 | **0** |
| bright content, source | rows 26–36, 244 px |
| bright content, render | rows 26–36, 242 px |

Same rows, same pixels. The clock sits at device y 54–73 and the icons at 51–73,
and none of it comes near the top of the screen or the rounded corner.

What is true is that the bar is **small**: the glyphs are 22 device pixels tall,
and at `SCALE` 0.5 that is eleven pixels on the finished frame. The flat top on
the "3" is in `pick.raw.mp4` as well as in `pick.mp4`, so it is the emulator's
own rendering and not the normalisation step.

Two things would actually change it, and both are bigger than a number:
**re-capture** on a device whose status bar draws larger, or **stop showing the
status bar** except in the two beats where the aeroplane is the evidence. Both
are decisions about the shoot, not edits to this cut.
