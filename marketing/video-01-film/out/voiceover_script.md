# Video 01 — product film · voice script

Six lines, 37 words, about 24 seconds. Record them, put the files in
`input/voice/`, then say "go".

**This is a different read from the first cut.** That one was a TikTok-native
script at 2.6 words a second, written to survive a thumb. This is a paid product
film at **1.5 words a second** — the picture is doing the arguing and the voice
is agreeing with it. If the read feels slow in the booth it is probably right;
the gaps are where the captions land.

## The lines

| # | Beat | Line | Words | Room | Pace |
|---|---|---|---|---|---|
| 1 | hero | These captions were made on a phone. | 6 | 3.1 s | 1.9 w/s |
| 2 | claim | No account. No upload. No server. | 6 | 3.3 s | 1.8 w/s |
| 3 | styles | Nine looks. Every one of them live. | 6 | 4.7 s | 1.3 w/s |
| 4 | emphasis | It hears which word you leaned on. | 7 | 3.6 s | 1.9 w/s |
| 5 | offline | The speech model is in the app. It works offline. | 9 | 4.3 s | 2.1 w/s |
| 6 | cta | Wordburn. One payment. | 3 | 2.7 s | 1.1 w/s |
| | | | **37** | **21.7 s** | **1.5 avg** |

Line 1 starts **1.4 seconds in**, not at zero. The film opens on the app's own
captions landing with nothing said over them, because the product is the first
argument and a voice arriving on frame one talks over it.

## How to read it

- **One person, explaining something they built.** Not a narrator, not an
  announcer, and not the bright upward-inflected read that reads as an ad. The
  register to aim at is a good documentation video: unhurried, certain, slightly
  close-mic'd.
- **Line 2 is three sentences, not a list.** "No account. No upload. No server."
  wants a full stop and a breath at each one. Read as a list it becomes a
  feature bullet; read as three statements it becomes a position.
- **Line 4 is the only one with a lean in it.** The word is *leaned* — the app's
  whole emphasis mechanism is that it hears which word was said harder, so the
  line should demonstrate itself.
- **Line 6 is flat on purpose.** "One payment" is the claim; selling it with the
  voice makes it sound like there is a catch.

ElevenLabs starting point: **stability ~55, similarity ~75, style 0–10.** Higher
stability than a social read, because this one wants consistency across six
short files more than it wants performance.

## Export

- **One file per line**: `line1.mp3` … `line6.mp3`, MP3 44.1 kHz.
- **Trim the silence** at both ends. The timing script measures each file and
  lays the picture out against what it measures, so half a second of leading
  room becomes half a second of a shot nobody is talking over.
- Put them in `input/voice/`.

Naming matches the beat ids in `config.json` — `line1` is `hero`, `line6` is
`cta`. If a beat's line changes, change it in `config.json`; this file is
generated from there and hand-edits get overwritten.

## Music

A product film needs a bed and there is not one yet. It is the only asset in
this video that does not already exist in this repository, and it has the same
condition every outside asset has: a source URL and a licence that allows
commercial use, written into `CREDITS.md` before it is mixed.
`scripts/mix-music-bed.py` exists in the app repo for putting a bed under voice
at a known ratio.

Suggested: something with no melodic hook and no drums, sitting about −20 dB
under the voice. The captions are the thing moving on screen and a track with a
pulse will fight them.

## Label it

The voice is synthetic, so TikTok's AI-generated-content toggle goes **on** at
upload. `out/post.txt` repeats that.
