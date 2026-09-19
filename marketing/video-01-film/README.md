# Video 01 — product film

A 24-second vertical product film for **paid** social, in three hook variants.
Captions-led: it opens on the app's own output and argues from there.

This replaced an organic-TikTok concept that was built first and rejected. What
survived the change is the pipeline — config-driven beats, one shared timeline
arithmetic, a storyboard and a self-check. What changed is everything the viewer
sees, and who takes the phone shots.

## The two rules it is built around

**1. Every caption in this film came out of the app.** Nothing here transcribes,
burns or draws a caption. The hero footage is a real export — `layoutCaptionFrame`
laid it out and `CaptionPainter` rasterised it, on the device — and
`scripts/selfcheck.mjs` greps for that rather than trusting it: a reference to
whisper, to an `.srt`, to ffmpeg's `subtitles` filter, or to the ad project's own
`CaptionTrack` fails the check.

**2. There is no third-party footage in it, and that is a legal position rather
than a style.** `STORE-ASSETS.md` bans stock from the listing because nobody
collects a model release and a face in an advertisement is the exact use a
release covers. A paid unit is more squarely an advertisement than a listing is.
An earlier cut had five Pexels clips with recognisable people in them; they were
deleted, and `fetch-broll.mjs` with them. `CREDITS.md` records why.

So the film is made entirely of things this repository owns: the app's export,
emulator recordings of the app, and the app's own typefaces.

## Phases

| Phase | Who | Output |
|---|---|---|
| 1. Silent cut | Claude Code | `out/film_a.mp4`, `out/storyboard.png`, `out/voiceover_script.md` |
| 2. Voice | Dennis, ElevenLabs | `input/voice/line1.mp3` … `line6.mp3` |
| 3. Voiced cut | Claude Code | `out/film_a/b/c.mp4`, covers, `out/post.txt` |

**Phase 4 is gone.** The original brief had Dennis filming the A54, on the
grounds that a machine cannot operate the app or record a phone screen. An
emulator is an Android device with an adb socket, `screenrecord` is on it, and
the app is installed — so `scripts/capture.mjs` takes the shots now. What a
machine still cannot do is *judge* them, which is why every capture is written
next to a start and end screenshot and the rule is that somebody looks.

## Running it

```sh
cd marketing/video-01-film

./run.sh --emulator                 # (from the repo root) boot a device with the app on it
node scripts/capture.mjs            # → input/app/*.mp4, from shots.json
node scripts/pull-export.mjs        # → input/app/export.mp4, after exporting in the app by hand
node scripts/render.mjs             # → out/film_a.mp4
node scripts/storyboard.mjs         # → out/storyboard.png
node scripts/selfcheck.mjs --phase=1
node scripts/credits.mjs            # → CREDITS.md
```

`node scripts/capture.mjs --probe` screenshots the device so coordinates can be
read off it when a screen moves. `--list` shows the shots.

## What the emulator taught us

- **`monkey` returns 251 on a launch that worked.** It prints "SYS_KEYS has no
  physical keys" and exits non-zero, which killed the capture run on its first
  shot. `am start` on the resolved component is the one that behaves.
- **`screenrecord` output is variable frame rate**, because it emits a frame only
  when the screen changes. A shot of playback reports something near 60 and a
  shot of a paused editor reports 0.47. Everything is normalised to CFR 30 on
  ingest — at the edge, once, the same rule the app follows for milliseconds.
- **A screen that never moves records as one frame with a duration of zero.**
  `fps=30` then drops it with "No filtered frames for output stream" and the
  encode writes a valid 261-byte mp4 containing no video: a capture that ran
  perfectly and output nothing. Forcing `-r 30` rescues it but throws away real
  timing, so the still case is detected and built from the screenshot instead.
- **`screenrecord` overshoots `--time-limit`** — a 3 s limit gave 4.2 s — so each
  shot is trimmed to its asked-for length and the timeline can trust it.
- **A fractional composition height takes down every composition in the file.**
  The storyboard's tile arithmetic produced 1499.185, Remotion refused to
  register it, and the failure presented as the *film* not existing. Round.

## The paid safe zone is the tightest constraint

`config.json` → `safeBox` is 60–960 × 211–**1128**, and that 1128 is the number
that shapes the whole film. An in-feed ad adds a CTA button and a Sponsored
label, and `../README.md` puts that at roughly 370 px on top of the organic
bottom allowance of 422. So anything that must be read stops 792 px from the
bottom, not 422.

That is why every line of type is in the upper third and why the export beats
put theirs at y 700 — between the app's own watermark at the top-left and the
captions in the lower third, which is the only band left on those beats. The
self-check draws the box on every sampled frame in green.

## Three frames per beat, not one

`selfcheck.mjs` samples at 25%, 50% and 75% of each beat. It used to sample the
midpoint only, and that is exactly how a defect got through: the style sheet's
tiles animate the user's own line, that line has pauses in it, and the midpoint
landed in one — six empty boxes under the words "Nine looks". Anything that
varies within a beat needs more than its middle looked at.

The same finding moved the style beat's window to 6.4 s, which also reaches the
scroll — so the sheet visibly goes past six presets to Headline, Neon and
Newsprint. The claim is now made on screen rather than only in the voiceover.

## Where things live

| Here | There |
|---|---|
| `config.json`, `timings.json`, `shots.json`, `app-shots.json` | `../remotion/src/film/` — the composition |
| `beats.js` — the timeline arithmetic, imported by both sides | `../remotion/src/brand.ts` — palette, faces, format |
| `input/`, `out/` — media in and out | `../remotion/public/film/` — the staged copy Remotion serves |
| `scripts/` — capture, pull, sync, render, storyboard, check, credits | |

One Remotion install, shared with the three ads in `../remotion/src/ads/`. A
second would be a second React and, worse, a second set of brand tokens for the
two to drift apart on.

`beats.js` is imported by the composition *and* by the node scripts, so the film,
the storyboard and the self-check cannot disagree about where a cut lands —
which is the failure `build-aab.sh` had when it printed back the version it had
asked for rather than the one it got.

## Still open

- **No music.** The only asset that will come from outside this repository, and
  it carries the same condition every outside asset does: source URL and a
  commercial-use licence in `CREDITS.md` before it is mixed.
- **No voice yet**, so the cut is silent and `render.mjs` passes `--muted`.
  Without it Remotion writes a silent AAC track and the film looks, to anything
  downstream, like it has already been through the voice pipeline.
- **Variants b and c are unrendered.** They change one line of type on the
  `claim` beat; `node scripts/render.mjs --variant=b` produces one.
- **Nothing here has run on the A54.** It does not need to — this is a render,
  not the app — but the *recordings* are of an emulator, and an emulator's status
  bar, fonts and corner radii are not a Galaxy's. If that matters for a paid
  unit, reshoot `shots.json` on the phone; `capture.mjs` targets whatever adb
  reports.
