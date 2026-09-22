# Video 03 — four pains, four voiced 9:16 ads

Four units of 23 to 27 seconds, each cut to one of Dennis's recordings in
`references/`.

**`payonce`**, from `pay_once_mark.mp3`:

> still paying every month just to caption your videos? wordburn does it right
> on your phone. drop in a clip, captions show up, tap a word to fix it, pick a
> style, export. nothing uploads, it all runs offline. pay once, keep it forever
> — no subscription, no renewal. get it free on google play and never pay for
> captions again.

**`nointernet`**, from `offline_mark.mp3`:

> can your caption app work with no internet? this one can. flip on airplane
> mode, drop in a clip, and captions still show up, because it all runs on your
> phone. tap a word to fix it, pick a style, export — nothing uploads, nothing
> leaves your gallery. pay once, keep it forever. get it free on google play and
> caption your videos anywhere, wifi or not.

**`nocredits`**, from `no_credit_mark.mp3`:

> have you ever run out of credits just to caption a video? most caption apps
> give you a few videos a month, then make you wait or pay. wordburn runs on
> your phone, so there's no credits, no quota, no limit. drop in a clip,
> captions show up, tap a word to fix it, export, next one — one video or a
> hundred, same thing. pay once, keep it forever. get it free on google play
> and caption as many videos as you want.

**`justcaptions`**, from `just_caption_mark.mp3`:

> ever open your caption app and get lost in all the ai tools you never asked
> for? wordburn is just the captions part. open it, drop in a clip, captions
> show up, tap a word to fix it, pick a style, export. no feed, no templates,
> no ai studio — that's the whole app. it runs on your phone, pay once, keep
> it forever. get it free on google play and get back to just posting.

`voice-script.md` and `payonce-voice.txt` are the earlier hand-written scripts
for these angles; this file is about the cuts that were actually built, from
the lines above, on 2026-09-22.

## Where it lives

| here | there |
|---|---|
| `words.payonce.json`, `words.offline.json`, `words.nocredit.json`, `words.justcaptions.json` — each recording's word timings, measured once | `../remotion/src/voiced/` — what the ads share: `time.ts`, `script.ts`, `Kinetic.tsx`, `Shots.tsx` |
| `input/voice/*.mp3` — the voices, out of git | `../remotion/src/payonce/`, `../remotion/src/nointernet/`, `../remotion/src/nocredits/`, `../remotion/src/justcaptions/` — one `Ad.tsx` and `script.ts` each; `nocredits/` also has a `Graphics.tsx` |
| `render.sh` | `../remotion/public/payonce/` — the staged voices |
| `out/wordburn-03-pay-once.mp4`, `out/wordburn-03-no-internet.mp4`, `out/wordburn-03-no-credits.mp4`, `out/wordburn-03-just-captions.mp4` | the app recordings: `../video-02-tutorial/input/app/`, reused whole |

```sh
cd marketing/video-03-pain-ads
cp ../../references/pay_once_mark.mp3 ../../references/offline_mark.mp3 ../../references/no_credit_mark.mp3 ../../references/just_caption_mark.mp3 input/voice/
./render.sh                        # payonce → out/wordburn-03-pay-once.mp4
./render.sh nointernet             # → out/wordburn-03-no-internet.mp4
./render.sh nocredits              # → out/wordburn-03-no-credits.mp4
./render.sh justcaptions           # → out/wordburn-03-just-captions.mp4
./render.sh nointernet --scale=0.5 # → out/preview/, a quick half-size check
```

`render.sh` stages video 02's recordings and sound into `public/tutorial/`
through video 02's own staging script, and the voice into `public/payonce/`.
Nothing under `public/` is a source.

## What the two share, and what the second one changes

`src/voiced/` is the ad-making kit both are built from: the clock (`F`, a
0.2 s lead), the script builder that turns a word file and a phrase table into
subtitle cues and `said(phrase, word)` frames, the kinetic type (`Kinetic`,
`Brand`, `Struck`, `WifiOff`) and the tutorial machinery (`PhoneShots`,
`Labels`, `ShotSound`). An ad is then a shot list, a label list and a handful
of frame numbers — `payonce/Ad.tsx` and `nointernet/Ad.tsx` are each under two
hundred lines and differ only in those.

The no-internet cut rearranges the tutorial around its claim:

- **The physical action first.** "Flip on airplane mode" is the quick-settings
  shade over Home and the Airplane tile pressed, from `toggle.mp4`, with the
  aeroplane appearing in the status bar as the tile lights. Six steps instead
  of five, so the ticks count it.
- **"captions still show up because it all runs on your phone" is one
  unbroken window** of `pick.mp4` from 39.85 s: the transcription finishes
  and the words land on "captions", the camera leans in on the aeroplane still
  in the status bar on "because", and the app's own step into the editor at
  42.75 s carries straight into the fix shot. No cut in the proof.
- **"nothing leaves your gallery" is the Saved screen**, tick and filename,
  rather than the Processing screen the pay-once cut uses for its offline line.
- **The offer has no struck pills** — this read has no "no subscription, no
  renewal" — and the close gets a Wi-Fi mark instead: it draws its arcs in on
  "anywhere" and takes the accent slash on "Wi-Fi", above the lockup.

## What the third one adds

The no-credits read is 27 s, a sentence longer at each end than the other two,
and both extra sentences have no app in them. So `nocredits/` is the one ad in
the family with graphics of its own, in `nocredits/Graphics.tsx`, and both are
built from one object: a small vertical tile with a caption bar in it — a
video with captions on it, which is what the app icon is a picture of.

- **The pain, 3.4–7.4 s.** "Most caption apps give you a few videos a month,
  then make you wait or pay" is three of those tiles under a "3 / month" chip.
  They arrive one per word on "Most caption apps"; on "then make you" they are
  spent one at a time, the chip counting "2 left", "1 left", "0 left" and
  turning coral at nought; and "wait" and "pay" land as coral pills under the
  empties on their own words, with the voice's "or" between them. The sentence
  is subtitled, because the graphic is a picture of it and not the words.
- **The name, then what it has none of, 8.4–12.3 s.** "Wordburn" lands alone
  in the middle, and "credits", "quota" and "limit" arrive as pills under it
  and take the accent line through them on each "no" — the pay-once ad's
  `Struck`, three across. **The phone waits for this beat to end.** In the
  other two it rises on "phone"; here a device rising under three pills would
  have covered them, so it comes up in the pause after "no limit" and the name
  lifts to become its label as it does, with three frames' less lead than its
  siblings' because the lift starts later and needs them.
- **"next one" is Home again**, with New video pressed a second time, which
  is what the words mean. Six shots rather than five, and the tap ring is on
  "one" so the press has landed before the phone leaves.
- **The hundred, 18.6–20.7 s.** The phone leaves and one tile — the same tile
  the pain beat spent three of — lands in the middle on "one" with a 1 over
  it. On "hundred" it shrinks into the top-left cell of a ten-by-ten grid and
  the other ninety-nine fill in behind it in a wave from that corner, the
  number over the grid counting the cells that have actually landed rather
  than running ahead of them. On "same" the accent sweeps the grid corner to
  corner and every bar it passes stays lit. The wave and the sweep both run on
  a cell's distance from the corner, so they read as one motion started twice.
  The second picture answers the first without either of them saying so.
- **The two graphics were timed against the preview, not the plan.** The
  first cut had the phone rising through the struck pills while "limit" was
  still being crossed out, and the one tile landing while the phone was still
  on its way down. Both are fixed by frame numbers in `Ad.tsx` and both were
  found by looking at the half-scale render, which is what it is for.

## What the fourth one is about

The just-captions read is the only one of the four whose pain is not a price
or a connection: it is clutter, and an ad about clutter has to show some and
then show its absence. `justcaptions/Ad.tsx` does that twice, once with the
words and once with the phone, and nothing else in it is new.

- **The clutter, 1.9–4.7 s.** The hook is the question set large, as in the
  others, but from "lost" onward a feature pill lands in the margin of the
  frame on every word — *AI avatars, AI dubbing, templates, auto zoom, AI
  b-roll, AI voices, trending, AI studio* — tilted, dim, swaying a little,
  above and below the question rather than over it. Eight generic names for
  the things a captions app grows, no brand and no screenshot, which keeps it
  on the right side of the line `../README.md` draws. They are dim on purpose:
  the question stays the loudest thing in the frame and the pills read as
  clutter because they are *around* it. On the beat after "for?" the question
  fades and the pills drop out of the bottom of the frame, one frame apart, so
  the name lands on nothing a third of a second later.
- **The name and its tagline, 5.3–7.0 s.** "Wordburn" lands alone in the
  middle on the word, and "just the captions part" arrives under it word by
  word with "captions" in the accent — the one sentence in the script that is
  the whole pitch, and the one place it is set as a title. The phone rises in
  the pause before "open it", the name lifts to become its label and the
  tagline fades under it.
- **"open it" is the New video press.** There is no recording of the app
  being launched — `home.mp4` is Home standing still — so the phone rising
  with Home already on it is the open, and the press at 1.5 s into `pick.mp4`
  lands on the pause after the words. Six labelled steps rather than five, the
  last three as the pay-once cut's one-line `Stepline`, with the shots under
  them a quarter second ahead of their words for the reason given there.
- **The absence, 13.4–17.5 s.** Home again, held for four seconds, and put
  back a step under a 62% dim while "feed", "templates" and "AI studio" arrive
  stacked over its middle and take the accent line through them on their
  words. On "that's the whole app" the three leave together and the dim lifts:
  what comes back up is the app, one screen with one button on it, under a
  headline that says so. The pills sit over the phone rather than replacing
  it for exactly that reason — the app has to still be there when they go.
- **"it runs on your phone" is Processing with the aeroplane ringed**, the
  words landing at 40.2 s of `pick.mp4`, without the lean-in: the shot is a
  second long and the phone leaves at the end of it, so a camera move there
  would be a move for its own sake.
- **The hook is nearly five seconds**, against three for the others. The
  recording is what it is, and the pills arriving on every word are what keep
  it from being a title card held for five seconds; the whole question is on
  screen by 4.5 s for a viewer who arrived muted.

## The shape of the pay-once cut

Four movements, every one placed on a word in `words.json` rather than on a
stopwatch. `script.ts → said(phrase, word)` is how a component asks "the frame
this word starts", and every cut, headline and tap ring goes through it.

1. **The hook, 0–3 s.** No app. The question set large on black, four short
   lines, each word arriving as it is spoken, "every month" in the accent. The
   whole question is on screen by 2.7 s for a viewer who arrived muted.
2. **The name, then the phone, 3.5–5.7 s.** "Wordburn" lands alone in the
   middle of the frame on the word. On "phone" the device rises from the foot
   of the frame and the lockup lifts and shrinks into the headline slot above
   it, so the app arrives *under* its name instead of a logo card cutting to a
   screenshot.
3. **The tutorial, 5.8–14.7 s.** Five steps, five shots from video 02's
   emulator recordings, one per step, each cut on the word that names it —
   *pick a clip · captions appear · tap to fix · 18 styles · save to gallery* —
   with five ticks under the label for where we are. Every shot carries the
   press the recording actually made, ringed two frames ahead of it: New
   video, the clip tile, the "1 to check" chip, the Read along tile, Save to
   gallery. Then the proof under "nothing uploads, it all runs offline":
   Processing with the aeroplane in the phone's own status bar, leaned in on
   and ringed, using video 02's measured region and pointer.
4. **The offer and the close, 14.8–23 s.** The phone leaves. "pay once" large
   in the accent, "keep it forever" under it, then a pill for *subscription*
   and one for *renewal*, each struck through on its word. Then the lockup with
   "Free on Google Play", and the last sentence subtitled beneath it.

## What was decided, and why

- **Shots crossfade; nothing punches.** Video 02's body found that a hard cut
  inside a walk-through asks the viewer to believe a step happened off camera.
  Here every shot is the same phone frame with a different screen in it, and an
  eight-frame fade reads as the app moving from one screen to the next. The
  brief asked for smooth and this is where smooth comes from.
- **The phone is drawn at 0.86 of video 02's size**, scaled about its head so
  the headline slot does not move. At full size the Save button, the dotted
  word and the foot of every sheet sat under the subtitle band, and a tap ring
  on a control the band covers is a tap on nothing. The shots here are about a
  second each, too short for the zoom video 02 uses to lift a low control into
  view, so the whole phone comes up instead. The foot lands at 1431, inside
  TikTok's 1498 line with room to spare.
- **The fix tap is on the chip, not the word.** The recording pressed "1 to
  check", and that press is what opens the dotted word's sheet; the ring goes
  where the press was. The narration says "tap a word" and the sheet that
  opens is that word's, which is the app's own route to it.
- **The hook and the offer have no subtitle.** On those beats the words are the
  picture, set large and arriving on the voice; a subtitle repeating the same
  sentence underneath would be the line twice in two sizes. Every phrase over
  the phone is subtitled, and both phrases under the close.
- **Nothing about anyone else.** The struck pills name two things this app
  does not have. No price, no brand, no "other apps", which is the line
  `../README.md` draws for anything that might one day run as a paid unit.
- **The tutorial's subtitles keep the transcript's punctuation** ("Drop in a
  clip,") and the kinetic titles drop it ("pay once"): a subtitle is a
  transcript and a headline is not.
- **The three quick steps are one headline, not three.** "tap a word to fix
  it, pick a style, export" is two and a half seconds of voice and three
  screens, and the first cut gave each its own headline, its own step tick and
  its own cut on the word — nine things arriving in the time it takes to say
  them. Dennis called that stretch too fast on 2026-09-22, and asked whether
  the animation should go. It was not the animation: a crossfade is what
  stops three screens reading as a slideshow. It was the count. So the line
  "fix · style · export" arrives once, ahead of the first word, and the accent
  moves along it as the voice does; the step ticks are gone from both ads;
  the three shots start a quarter second *before* their words, so each
  screen is already there when the word lands and the press happens on it;
  and the lean-in on the aeroplane under "runs offline" is half as deep and
  no longer comes back out, because the return was a second camera move
  straight after three cuts and the phone leaves anyway.
- **No sound effects.** The first cut carried video 02's generated family — an
  opener, a cut per shot change, a mark on each tap, the lean-in, the riser —
  and Dennis called it too much on 2026-09-22. The voice is the only track;
  the cuts and taps are carried by the picture alone.

## The word timings

`words.payonce.json`, `words.offline.json`, `words.nocredit.json` and
`words.justcaptions.json` are each
recording aligned to its own script, measured once with a local speech model on this machine and
checked against the recording's own pauses — every cut in these videos sits
on one of those numbers. They are tracked because they are decisions, not
bytes: re-measure one if its recording is ever re-recorded, and `buildScript`
will refuse a file whose word count no longer matches the ad's phrase table.
The transcript's "Wi" and "-Fi" were joined into one word by hand. Nothing in `../pipeline/` turns audio into words;
video 02's self-check greps for that and this project keeps the rule.

## Before posting

- **The Play listing is not live.** The close says "Free on Google Play" and
  the voice says it too. Nothing here may be posted until that page exists.
- **The recordings are of app 1.0.3 on an emulator**, video 02's captures.
  Status bar, fonts and corner radii are the emulator's. For organic posts
  that is fine; re-capture through video 02's `capture.mjs` if the app's
  screens change.
- **The voice is synthetic**, so the AI-generated-content toggle goes on at
  upload.
- **Look at it at full size before judging the type.** The half-scale preview
  in `out/preview/` is for checking cuts, not weights.
