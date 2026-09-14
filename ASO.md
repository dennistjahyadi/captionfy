# Play Store listing

The text to paste into Play Console, and the reasoning behind it. Counts are
against Google Play's limits and were measured, not estimated.

| Field | Limit | This text | |
|---|---|---|---|
| App name | 30 | 30 | exact |
| Short description | 80 | 71 | |
| Full description | 4000 | 1889 | |

The market is **English-speaking**. An earlier draft leaned on `hardsub`, which
is a real search term in Indonesia and Vietnam; in English it is anime-fansub
jargon that a short-video creator does not type. That draft is not here.

## App name — 30/30

```
Wordburn: Subtitles & Captions
```

Every character used. English searchers split roughly evenly between
"subtitles" and "captions" and neither can be owned, so the title covers both
rather than betting on one. The title is the highest-weighted ranking field on
Play — around two to three times any other — so the eight characters the brand
costs are the only ones not working.

`Wordburn: Auto Captions` (23/30) is the cleaner-reading alternative. Run the
two against each other with a Play Console **store listing experiment** rather
than arguing about it.

## Short description — 80/71

```
Auto captions & subtitles for your video. Offline, on-device, pay once.
```

Second-highest-weighted field. Keywords first, then the two claims no
competitor in this category can make.

## Full description — 4000/1889

```
Wordburn adds captions to your video without sending it anywhere.

Pick a clip and the speech is transcribed on your phone. No server, no account, no upload, no sign-in. Wordburn works in airplane mode exactly as well as it works on wifi, and your video never leaves your device.

AUTOMATIC CAPTIONS, ON YOUR PHONE
Speech recognition runs offline, on-device. Drop in a clip and get word-by-word captions with timing, ready to edit.

FOUR CAPTION STYLES
Clean subtitle, box highlight, karaoke fill and editorial. Every style animates word by word, and the preview is exactly what gets burned into the file.

EDIT EVERY WORD
- Fix a misheard word without changing its timing
- Nudge, split, merge and drag word timings on a waveform
- Shift every caption at once if the captions run early or late
- Low-confidence words are flagged so you know what to check
- Undo and redo everything

MAKE IT YOURS
Choose the colour, the text size, the position on the frame and how many words appear per line. Your style is remembered for the next video.

A PERSONAL DICTIONARY
Teach Wordburn how to spell your brand, your handle or a name it keeps getting wrong. Spell it once and it is spelled that way in every video after.

EXPORT
Captions are burned into the video offline, at full quality and saved straight to your gallery. Audio is copied across untouched, with no second compression pass. You can export a .srt subtitle file too.

PAY ONCE
Wordburn is free to use in full: unlimited videos, unlimited length, every caption style and every editing tool. Free exports carry a small watermark in the corner. One purchase removes it forever. There is no subscription and there never will be.

An auto subtitle maker, caption generator and subtitle burner in one app, working entirely offline.

PLEASE NOTE
Wordburn transcribes English. It does not translate and does not yet support other languages.
```

Keyword counts in it: caption ×9, word ×14, burn ×8, video ×6, subtitle ×4,
offline ×3. Play indexes the full description; that is repetition that reads as
English rather than as stuffing.

## Three things this text assumes

- **It describes the watermark tier, not the export counter.** The listing says
  free exports carry a watermark and one purchase removes it. That is the
  monetization spec. The code still ships the three-free-exports counter from
  slice 9. Whichever ships, the listing has to match it or it is a Play metadata
  violation and a run of one-star reviews.
- **TikTok, Reels and Shorts are deliberately absent.** They are good keywords
  and plenty of caption apps use them, but Play's metadata policy discourages
  references to other brands and it is an avoidable rejection on a first
  submission. Add them later, once live, as an experiment.
- **The PLEASE NOTE block is doing ASO work, not legal work.** English-only is
  the biggest review risk: one wrong-market install rating one star costs more
  ranking than the extra keywords would earn.

## Still to do by hand

- The name is not trademark-cleared. Nothing has been searched at
  [WIPO](https://branddb.wipo.int/), [USPTO](https://tmsearch.uspto.gov/) or
  EUIPO in classes 9 and 42, and those are the only bodies that can force a
  rename after launch.
- What is verified: `wordburn.app` is unregistered, `com.wordburn.app` returns
  404 on Play, and no app or company called Wordburn was found in this category.
  Nearest neighbour is "Word Burst Puzzle Game", which is not a clash.
- `Word-` is game-coded on app stores (Wordscapes, Word Burst, Words with
  Friends). The icon and the `Subtitles & Captions` suffix should resolve it in
  a search row. Watch the first weeks of impression-to-install data; that is
  where it would show.
- Reserve the App Store Connect name and the social handles. The Play package
  name hardens permanently at first upload.
