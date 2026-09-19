# Video 02 — six hooks, one tutorial

Six organic TikToks. Each opens on a different three-second hook and then plays
**the same tutorial body**: a walk through everything the app does, in 27.5
seconds. Six uploads, one variable. The body is the control and the hook is the
experiment, so whichever of the six holds viewers past three seconds says
something about the hook and nothing else.

This is `../README.md`'s own advice, built: it says the three ads are a
template and the script is the only thing that should change between posts.
Here the hook is the only thing that changes — and it is *literally* the only
thing, because the body is rendered once and joined to each hook without a
second encode, and the self-check hashes every body frame in all six files to
prove they are the same.

**Status: phase 1 done — the silent cuts, storyboard and self-check exist.**
Built on 2026-09-20 from a plan reviewed the same day. Phase 2 is a voice, which
is Dennis's; phase 3 re-times the body to it.

## Shape

```
[ hook · 3.0 s ]  hard cut  [ body · 27.5 s ]
                             pick → transcribe → editor → fix → timing → styles → dictionary → export → close
```

| | |
|---|---|
| Surface | Organic TikTok first, 9:16, 1080 × 1920, 30 fps. Reels and Shorts get the same file. |
| Length | 30.5 s. Longer than the 11–18 s band `../README.md` cites for completion, and that is the accepted cost: a tutorial that shows every feature does not fit in 15 s, and a tutorial that skips half of them is not the thing that was asked for. If completion is poor, the second cut is a 15 s body with `fix`, `timing` and `dictionary` dropped — a list edit in `config.json`. |
| Safe box | **Organic**, not paid: 60–960 × 211–**1498**. Video 01's 1128 floor was for an in-feed ad's CTA and Sponsored label. `safeBox.kind` in the config picks which, the self-check refuses a config whose numbers disagree with its kind, and every title is positioned from the box rather than by hand, so flipping it moves all of them. |
| Cuts | **Hard**, with a frame of overshoot (`Punch`), the way the three ads cut. Video 01 dissolves because it is a paid product film; these are organic, where a dissolve reads as manufactured. |
| Sound | On-screen text carries everything; a large share of viewers arrive muted. Voice is phase 2 and optional on the hooks. No music baked in — add a sound at upload so it is attributable. |
| Register | Lowercase, specific, one person talking. "it flags what to check", not "AI-powered confidence detection". |

## The two rules, inherited

1. **Every caption on screen came out of the app.** The body is emulator
   recordings of the real app and one real export the app made during the
   `saving` shot. Nothing here transcribes, burns or draws a caption, and the
   self-check greps `../pipeline/`, `src/tutorial/` and `src/parts/` for
   whisper, `.srt`, the `subtitles` filter and the ad project's `CaptionTrack`,
   exactly as video 01's does.
2. **No third-party footage, no faces.** Everything is the app's own export,
   recordings of the app, and the app's own typefaces. `STORE-ASSETS.md` has
   the reason.

## The six hooks

Each is an entry in `config.json → hooks`: a hook type, the text on screen, the
footage under it, an optional voice line, and where in the footage it starts.
Three seconds each, text on screen at 0.2 s, because the algorithm decides at
1.5 s and the hook has to have resolved by 3. The self-check refuses a hook
whose text arrives after 1.0 s.

| # | id | type | on screen | under it |
|---|---|---|---|---|
| 1 | `outcome` | outcome showcase — the payoff is the opening frame | **these captions were made on a phone** | `export.mp4` full-bleed from 6.0 s: "Don't." then "Take **one** day.", the free-tier mark in its corner |
| 2 | `airplane` | physical action — a pattern interrupt | **airplane mode on. can it still caption?** | the quick-settings shade over Home, the Airplane mode tile tapped and turning on; cut to Processing with the aeroplane in the status bar, ringed |
| 3 | `pay-once` | contrarian, about this app only | **most caption apps bill you monthly. this one bills you once.** | `ads/PayOnce`'s stack of pills arriving beside the one that does not, over the Unlock screen's headline and four ticks |
| 4 | `emphasis` | demonstration of the one thing nobody else does | **it hears which word you leaned on** | `export.mp4` from 13.0 s — "Then ask for **20%**", the box landing on the yellow word at 14.0 — with `ads/Emphasis`'s waveform spiking on that frame |
| 5 | `no-account` | claim-first — three statements, not a list | **no account. no upload. no server.** | Home, with no sign-in anywhere on it; cut to Processing |
| 6 | `styles` | outcome showcase, the other payoff | **nine caption styles. all animating your own words.** | the style sheet's grid, every tile animating the transcript's own first line |

Why these six: they cover the hook shapes the OpusClip study found working and
none of the four it found failing — no face-on greeting, no "okay so", no "have
you ever wondered", no story that assumes trust. Two are outcome hooks because
that type performed best and the app has two payoffs to show. Hook 3 is worded
the way `../README.md` settled after the policy problem: a claim about Wordburn,
no brand named, no dollar figure on screen. The figure goes in the post copy.

**The Unlock screen is cropped to its headline and ticks on purpose.** Its
price button spins forever on this emulator, because `captions_unlock_v1` does
not exist in any Play Console yet, and a spinner in a hook about paying once
would be the wrong three seconds.

The spare, if one of the six is dropped: **`fix`** — the low-confidence chip,
which no competitor has. It is in the body regardless.

## The body

Nine beats in `config.json → beats`, shared by all six. Every beat is a band of
a screen recording as a card (`ScreenCard` at 0.78 scale, so the type is near
the size the app draws it), one lowercase line above it, and a voice line the
picture will wait for once there is one.

| # | id | screen | on screen | s |
|---|---|---|---|---|
| 1 | `pick` | Home → **New video** → the system picker, "Wordburn will only have access to the photos you select" | kicker **how it works** · **pick a video** | 2.5 |
| 2 | `transcribe` | Processing — "Transcribing", the aeroplane in the phone's own status bar ringed — and the transcript landing in the editor | **it transcribes on the phone. nothing is uploaded.** | 3.0 |
| 3 | `editor` | the editor playing: captions on the stage, the transcript under it, **one** and **three** already bold | **timed to the word. the loud one gets big.** | 2.5 |
| 4 | `fix` | the **1 to check** chip opens "Don't." — "Not sure about this one" — and **Looks right** clears it; the chip is gone | **it flags what to check. one tap to fix.** | 3.5 |
| 5 | `timing` | the Timing sheet: the word's window on the waveform, the end handle dragged out, **Move +50** | **nudge any word. the rest stays put.** | 3.0 |
| 6 | `styles` | the style sheet scrolled past six presets to Headline, Neon, Newsprint, then the colour, size and position controls | **nine looks. your colour, your size, your position.** | 4.5 |
| 7 | `dictionary` | a word's sheet → **Add to your words** → the dictionary with the entry half written → **Save** | **teach it your words once** | 2.5 |
| 8 | `export` | Export → **Save to gallery** → the progress bar; cut to Saved: the tick, Share, and the feedback card | **export in seconds. share anywhere.** | 3.5 |
| 9 | `close` | `export.mp4` full-bleed from 5.5 s, the name and "Android · one payment" over it — a `CtaOverlay`, not an end card | — | 2.5 |
| | | | | **27.5** |

Beat 3 is where the acoustic emphasis gets its sentence; it is the app's one
mechanism the four reference apps cannot copy, so it is in the body of every
video and the hook of one. Beat 9 is an overlay on a running shot for the
reason `../README.md` gives: three seconds of static logo is a tenth of the
runtime doing nothing, and completion is what gets distributed.

The watermark is in every export shot, because the emulator is on the free tier.
That is correct: these are honest recordings, the mark is what a free export
looks like, and hook 3 is the one that explains it away.

## Running it

```sh
cd marketing/video-02-tutorial

./run.sh --emulator                      # (from the repo root) boot a device with the app on it
node ../pipeline/capture.mjs             # → input/app/*.mp4, from shots.json
node ../pipeline/capture.mjs saved       # → the Saved screen, once the export has actually finished
node ../pipeline/pull-export.mjs         # → input/app/export.mp4, the one the `saving` shot made
node ../pipeline/render.mjs              # → out/body.mp4, out/hook_*.mp4, out/tutorial_*.mp4
node ../pipeline/storyboard.mjs          # → out/storyboard.png
node ../pipeline/selfcheck.mjs --phase=1
node ../pipeline/voiceover.mjs           # → out/voiceover_script.md
```

`--hook=airplane` renders one; `--only=body` or `--only=hooks` renders half.
`capture.mjs --probe` screenshots the device so coordinates can be read off it
when a screen moves — `shots.json → where` is every coordinate this video
depends on, named, so the next re-read has a list to work down.

## Where things live

| Here | There |
|---|---|
| `config.json` — the hooks, the beats, the safe box, the pointers | `../remotion/src/tutorial/` — `Hook`, `Body`, `Tutorial` (the join, for the studio), `Segments`, `Storyboard` |
| `shots.json`, `app-shots.json`, `timings.json` | `../remotion/src/parts/` — `ScreenCard`, `Title`, `ExportShot`, `Pointer`, `Sheet`, shared with video 01 |
| `input/`, `out/` — media in and out, both out of git | `../remotion/public/tutorial/` — the staged copy Remotion serves |
| `../pipeline/` — capture, pull, sync, render, storyboard, check, voice script | |

**The plan said `hooks/hook1.json` … `hook6.json`; they are a `hooks` array in
`config.json` instead.** One import for the composition, one file for the
self-check to read, and a hook is twelve lines — six files was a folder for
the sake of a folder.

**The scripts moved.** They were video 01's `scripts/`, they now serve two
videos from `../pipeline/`, and they take the project from the directory they
are run in. Video 01 runs unchanged from its own folder. `parts.tsx` moved with
them, from `src/film/` to `src/parts/`, and reads the safe box and the staging
folder from a context each composition provides — a part that imported the
film's timeline would have drawn this video's titles against the film's paid
floor, which is the cross-wiring a second copy would have been made to avoid.

## The render: one body, six joins

`render.mjs` renders `tutorial-body` once and `tutorial-hook` six times, then
joins each hook to the body with ffmpeg's concat demuxer and `-c copy`. No
second encode. Remotion writes both halves with the same encoder settings, each
file starts on a keyframe, and the join is clean. Rendering the whole 30.5 s six
times would also work and is the fallback if a seam ever shows; none has.

The self-check then decodes every frame from 3.0 s onward in each of the six
files to an MD5 and compares the six lists. Identical lists are the proof that
the body is the same in every file, and a re-encode anywhere would show on
frame one.

## What the emulator taught us, on top of video 01's list

- **The recorder can finish before the script stops it.** `screenrecord` gets
  `--time-limit duration + 3`, the style shot's steps summed to a hair under
  that, and the recorder reached its limit first. `pkill` then found nothing,
  threw, and killed the whole run — for a file that had been finalised
  perfectly. The limit is now duration + 8 and a `pkill` that finds nothing is
  treated as the recorder having done its own job.
- **A teardown that undoes a shot has to be checked like a shot.** Two cuts of
  the style shot's teardown left the entire app red, and the two shots taken
  after it — the dictionary, the export — had to be taken again. The first
  tapped the Box highlight tile at the sheet's scrolled position, where that
  same y is the swatch row. The second scrolled back up with a swipe that
  started on the sheet's title, outside the scroll view, so it never scrolled
  and the tap landed on the red swatch again. Any step that runs off camera
  needs its end frame looked at exactly as hard as the ones on camera.
- **Transcription is fast and export is slow here.** A 0:19 clip transcribes in
  about six seconds on this emulator, so "the words arriving" is a screen that
  reads *Transcribing* for a moment and then the editor with the transcript in
  it — which is what the `transcribe` beat now shows. The same clip takes
  **54 s to export**, so the `saving` shot never reaches Saved; the Saved
  screen is its own shot, `saved`, with no setup, run once the export has
  actually finished. The export beat cuts from the progress bar to it.
- **The transcript's rows move when the style changes.** The editor spaces
  words by the preset's own box padding, so a word probed at one coordinate
  in Spotlight sits a hundred pixels lower in Box highlight. The dictionary
  shot's first re-take tapped a gap between words and, three seconds later,
  its *second* tap — meant for "Add to your words" — landed on the transcript
  instead and opened a different word. `shots.json → where` records the
  preset every coordinate was read in. Re-probe after a style change.
- **Two seconds between taps was not enough, three is.** The word sheet took
  longer to open with two projects on the device than it had with one, and a
  tap that lands before a sheet is up lands on whatever is under it.
- **The dictionary lists "rate" twice**, because two earlier takes each saved
  it before their footage was thrown out. It reads as a list of the user's
  words, which is what the beat is about, and at card scale for a second and a
  half nobody will count. A clean device would show one.
- **`Looks right` does not close the word sheet**, so the fix shot's teardown
  sends a Back before it taps undo — a Done at a fixed coordinate would have
  moved, because the sheet lost a row.
- **The system picker's privacy card is the app's own claim in someone else's
  words** — "Wordburn will only have access to the photos you select" — and it
  moves the grid down by its own height. The tap on the demo clip is aimed
  below it; if the card is ever dismissed, the coordinate is wrong.
- **The dictionary entry is "rate", not a brand name.** The demo clip has no
  proper noun in it, and typing one into somebody else's transcript would have
  been a correction the engine never needed. The beat says "teach it your words
  once", which is what it shows.

## Phases

| Phase | Who | Output |
|---|---|---|
| 0. Plan | — | reviewed 2026-09-20 |
| 1. Capture and silent cut | Claude Code, emulator | **done** — `input/app/*.mp4` with start/end stills, `out/body.mp4`, `out/hook_*.mp4`, `out/tutorial_*.mp4` silent, `out/storyboard.png`, `out/selfcheck/`, `out/voiceover_script.md` |
| 2. Voice | Dennis, ElevenLabs | `input/voice/body_1..9.mp3`, and `hook_1..6.mp3` if the hooks get a voice |
| 3. Voiced cut | Claude Code | the six files re-timed to the measured lines, `out/post.txt`, `CREDITS.md` |

## Post copy, first draft

Lowercase, one per hook, the app named once and late. Numbers live here and
not on screen. One upload a day for six days, same time each day, same sound
or no sound, so the six are comparable.

1. **outcome** — "made these on my phone. no laptop, no upload, no account. the whole speech model is inside the app so it works in airplane mode. it's called wordburn, android only."
2. **airplane** — "turned the internet off and captioned a video anyway. the model is 82mb and it lives in the app. wordburn, android."
3. **pay-once** — "captions subscriptions run about $19–25 a month now. built wordburn instead: one payment, no credits, no monthly cap. android."
4. **emphasis** — "every captions app makes you pick which word gets highlighted. this one listens for it — louder, held longer, a pause before it. no keyword list. wordburn, android."
5. **no-account** — "no account. no upload. no server. that's not a slogan, there literally isn't one — your video never leaves the phone. wordburn, android."
6. **styles** — "nine caption styles and every one of them animates your own words live while you pick. wordburn, android."

Tags per post from `../README.md`'s sets, three to six of them.

What to read a week later, per hook: **3-second hold**, **completion**, and
**profile taps**. The body is identical, so a spread in those three numbers is
the hook.

## Before posting anything

- **"on google play" is not true yet.** The close beat says "Android · one
  payment" and the post copy says "android" until the listing is live.
- **The AI-voice toggle goes on** at upload for any voiced cut.
- **The recordings are of an emulator.** Status bar, fonts and corner radii
  are not a Galaxy's. For organic posts that is fine; the caveat is in video
  01's README and it stands.
- **The Saved screen carries the feedback card**, because this emulator had
  made its second export. It is real UI and it stays; it is also the only
  frame in the six videos that names an email route, and it is on screen for
  a second and a half.
- **No music.** If one is mixed in later it needs a source and a commercial
  licence in `CREDITS.md` first.
- **Look at `out/storyboard.png` and `out/selfcheck/` before anything else.**
  The self-check can prove the six bodies are identical, the safe box is the
  right one and no caption was drawn here; it cannot tell whether a line reads
  well over a shot. That is the review.
