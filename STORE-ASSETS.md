# Store graphics

Prompts for generating the Play Store art, and the specs they have to hit.
Companion to ASO.md, which carries the text. The icon exists: three
left-aligned caption pills with the active one in the accent yellow, cut at
every size by `scripts/make-icons.py`, with the vector in `store/`.

**The feature graphic exists**: `store/play-feature-graphic-1024x500.png`, cut by
`scripts/make-feature-graphic.py` from real device screenshots in `store/shots/`,
not from a mockup. In front is the video's own rectangle with a caption burned
into it, which is what the user actually gets; behind it a screen of the app.
The type is the app's own — Spectral for the promise, Be Vietnam Pro for the
rest — and the words are ASO.md's words, so the graphic cannot drift from the
listing. Re-shoot and re-run the script when a screen changes.

Two things the shots have to survive. **The status bar and the dev-launcher
bubble are cropped off**, because the captures came from a debug build and that
blue gear sits exactly over Export. **No third-party footage.** The talking-head
test clips are licensed for testing and not for redistribution, so a frame of
somebody's face cannot go in a listing; the mock clips the project renders for
itself can.

**The phone screenshots exist**: `store/play-screenshots/*.png`, eight of them at
1080 × 1920, composed by `scripts/make-screenshots.py` from device captures in
`store/shots/listing/`. Re-shoot and re-run when a screen changes.

The video inside every one of them is `scripts/make-demo-clip.py`'s output,
which is the part of this that had no answer before. See **The demo clip** below.

## The demo clip, and why stock footage cannot be it

`scripts/make-demo-clip.py` generates the video every screenshot is taken on:
1080 × 1920, defocused warm plates drawn in Pillow with bokeh highlights, drifted
and crossfaded by ffmpeg, under a macOS `say` voice reading a script kept in that
file. Three lengths — `short` (0:20, the listing clip), `long` (1:00) and `xlong`
(3:02, which exists only so Processing lasts long enough to photograph).

It looks generated because it is, and that is the trade. What it buys is a clip
this repository owns outright, with no face in it, that can go on a store page.

**The free stock libraries cannot supply this, for two independent reasons.**

- **They publish video without sound.** Pexels strips the audio track from every
  upload as policy, and shows a "Published without audio" marker while you are
  uploading. Mixkit, Coverr and the free tier of Videvo are b-roll libraries in
  practice. A captions app cannot be tested on silence, and "talking head" as a
  search term returns footage of a person's mouth moving with nothing on the
  audio track.
- **Nobody collects a model release.** Pexels and Pixabay both allow commercial
  use and both state that they do not verify that the photographer had
  permission; the licences additionally forbid implying that a person depicted
  endorses your product. A face in a Play listing is an advertisement for the
  app, which is the exact use a release exists to cover. Play's own Store
  Listing and Promotion policy is a separate hurdle on top of that.

So stock is out for the listing, and nearly useless for testing. **What is
actually good for testing**, and what this repo already uses:

| Need | Source | Licence |
|---|---|---|
| Accented English, known ground truth | Speech Accent Archive, via `scripts/fetch-accent-samples.sh` | CC BY-NC-SA — benchmarking only, never ship |
| Public-domain speech on video | Internet Archive, Wikimedia Commons, NASA and other US federal footage | public domain in the US; `test-clips/`'s JFK clip is this |
| Clean read speech, lots of it | LibriVox, Mozilla Common Voice | public domain / CC0 — audio, so mux it onto a plate |
| Music under voice at known SNR | any CC bed through `scripts/mix-music-bed.py` | depends on the bed |
| A vertical clip nobody owns but us | `scripts/make-demo-clip.py` | ours |
| **Real creator audio** | record it on the A54 | ours |

The last row is the one that matters and the one no library replaces. Everything
above it is clean, close-miked, read aloud or synthetic. This app is for a phone
held at arm's length in a room with a fridge in it, and the only way to know
whether `base.en` survives that is to record it. Treat a good score on any of
the rows above as a floor.

## What Play actually asks for

| Asset | Size | Format | Required |
|---|---|---|---|
| App icon | 512 × 512 | 32-bit PNG, ≤ 1 MB | yes |
| Feature graphic | 1024 × 500 | PNG or JPEG, **no alpha**, ≤ 15 MB | yes |
| Phone screenshots | 9:16, 1080 × 1920 | PNG or JPEG, ≤ 8 MB each | yes, 2–8 |
| Tablet screenshots | 1600 × 2560 | PNG or JPEG | only for large-screen eligibility |
| Promo video | YouTube URL | — | no |

The "500 × 500" in common circulation is the old spec; it is **512 × 512** and
has been for years. Play applies its own corner mask and drop shadow to the
icon, so the file is a full square with square corners and no shadow of its own.

In the app, separate from the listing:

| Asset | Size | Note |
|---|---|---|
| `assets/icon.png` | 1024 × 1024 | iOS and the fallback |
| `assets/android-icon-foreground.png` | 512 × 512 | art inside the centre 66% (≈ 340 px) |
| `assets/android-icon-background.png` | 512 × 512 | flat `#0B0B0F` today |
| `assets/android-icon-monochrome.png` | 432 × 432 | one-colour alpha silhouette, themed icons |
| `assets/splash-icon.png` | 1024 × 1024 | |

`app.json` sets the adaptive background to `#0B0B0F` while the chrome's ground
is `#0F0E0D`. Pick one before generating anything; the warm `#0F0E0D` is the one
the app is actually built on and the cool `#0B0B0F` is Expo's leftover.

## The palette, for pasting into any prompt

```
ground        #0F0E0D   warm near-black
surface       #1A1817
hairline      #2C2926
muted text    #9A928A
paper text    #F2EFEC
accent        #FFE03D   the default caption yellow
on-accent     #111111   text that sits on the accent
```

Type is **Be Vietnam Pro ExtraBold** for everything and **Spectral ExtraBold**
for one serif headline. Both are in `assets/fonts/` and both are OFL, so they
can go straight into the graphics.

## The icon — done, and not by prompting

`scripts/make-icons.py` draws it and cuts every size. It is five rounded
rectangles, so there was nothing for an image model to contribute that the
geometry does not say exactly: run the script and the whole set is current.

The mark is **three caption lines with the active one highlighted** in the
caption yellow — the box highlight preset read at a distance.

The constraint it was designed against is the one ASO.md names: `Word-` is
game-coded on app stores. Wordscapes, Word Burst, Words with Friends. Letter
tiles, a grid, a playful gradient or a bouncy rounded face puts Wordburn in that
row and the install never happens.

### What the first version got wrong

The obvious mark is the preset drawn literally: a yellow box with the dark word
inside it, the way `#111111` on `#FFE03D` looks on screen. It does not work.
Against the `#0F0E0D` ground the word is not a word, it is a **hole**, and the
box stops reading as a highlight and starts reading as an empty outline. Six
proportions of it were rendered at 48 px and every one was a yellow rounded
rectangle with a slot punched through it.

So the word is not drawn at all. The highlight stays a solid mass and the word
is implied by the block being word-shaped among its neighbours, which is what
the highlight looks like on screen anyway. The yellow is then the largest and
brightest thing in the icon, which is the point: `#FFE03D` is the brand.

The runner-up was a portrait video frame with the caption in its lower third —
more specific about what the app does, and the strongest possible answer to the
word-game risk. It lost on the mask. Android crops an adaptive icon to the
centre 66.7% and then masks that to a circle, and a tall portrait shape fits a
circle badly: it had to shrink to 0.64 scale where the stack holds 0.80, which
left the icon reading small next to its neighbours and the yellow reduced to a
detail inside a grey outline. That is worth knowing before anyone proposes a
phone outline again.

### What the script writes

| File | Size | |
|---|---|---|
| `assets/icon.png` | 1024 | opaque — iOS rejects an icon with alpha |
| `assets/splash-icon.png` | 1024 | mark on transparency |
| `assets/favicon.png` | 48 | |
| `assets/android-icon-foreground.png` | 512 | scaled 0.797, art 161 px from centre against a 171 px safe circle |
| `assets/android-icon-background.png` | 512 | flat `#0F0E0D` |
| `assets/android-icon-monochrome.png` | 432 | white silhouette, lines at 58% alpha |
| `store/play-icon-512.png` | 512 | the listing upload, 6 KB against Play's 1 MB cap |
| `store/wordburn-mark.svg` | vector | master, for the feature graphic |
| `store/wordburn-mark-bare.svg` | vector | master with no ground |

Checked under all three launcher masks, and tinted both ways as a themed icon.
The monochrome keeps its hierarchy through the tint because the highlight is at
full alpha and the two lines are at 58% — colour is the one channel a themed
icon throws away, so the yellow can do no work there.

`app.json` had the adaptive background at `#0B0B0F`, an Expo-template leftover
that disagreed with the `#0F0E0D` ground in `src/ui/theme.ts`. It is the theme
colour now.

## Feature graphic — 1024 × 500

This is the banner at the top of the listing. Two rules that decide the
composition: it is cropped differently on different Play surfaces, so keep
everything meaningful inside the centre **924 × 400**; and if a promo video is
ever attached, Play drops a play button over the middle.

**Set the type yourself.** Every image model mangles text at this size, and the
real Be Vietnam Pro is sitting in `assets/fonts/`. Generate the plate, then add
the words in a vector editor.

The plate:

```
A wide 1024x500 banner background, flat vector, no text.

Solid warm near-black #0F0E0D ground. Across the right third, a stylised
vertical phone-shaped video frame, portrait 9:16, drawn as a simple
rounded rectangle outline one or two pixels wide in dark warm grey
#2C2926, tilted very slightly, cropped by the right edge of the banner.
Inside its lower third, a bright yellow #FFE03D caption bar with a short
dark #111111 block inside it, and one thin muted grey #9A928A bar beneath.

The left two thirds are empty near-black, completely clear, reserved for
type.

Flat 2D vector, geometric, hard edges, no gradients, no glow, no
photography, no hands, no people, no device bezels or buttons, no
reflections, no text, no letters, no logos. Calm and dark. Generous
empty space on the left.
```

Then set, on the empty left:

- Headline, Be Vietnam Pro ExtraBold, `#F2EFEC`, around 64 px, tight tracking:
  **Captions that never leave your phone**
- Sub, Be Vietnam Pro Medium, `#9A928A`, around 30 px:
  **Offline · on-device · pay once**

Both lines come from the short description in ASO.md, so the banner and the
text below it say the same thing. Do not put the app name in the graphic — Play
prints it directly above, and repeating it wastes the only wide surface in the
listing.

## Screenshots — generate the frame, never the screen

Play's Store Listing and Promotion policy requires screenshots to show the real
app. A generated mockup of a screen that does not exist is a metadata violation
and a takedown risk, so the pixels inside the phone are captured off the A54:

```sh
adb exec-out screencap -p > shot-01.png
```

Eight captures, in the order the listing should tell the story. The headline
above each is copy, not decoration — it is read far more often than the full
description:

| # | Screen | Headline |
|---|---|---|
| 1 | Editor, box highlight mid-word | **Captions, burned in** |
| 2 | Processing, progress running | **Transcribed on your phone** |
| 3 | Style sheet, tiles live | **Eighteen styles, word by word** |
| 4 | Word sheet open on a flagged word | **Fix a word without moving its timing** |
| 5 | Timing sheet, waveform and handles | **Drag the timing on the waveform** |
| 6 | Dictionary list | **Teach it how you spell your name** |
| 7 | Export screen | **Full quality, straight to your gallery** |
| 8 | Home with the free-tier line | **Pay once. No subscription.** |

All eight are taken. `scripts/make-screenshots.py` composes them; the captures it
reads are in `store/shots/listing/`.

**Shot 7 settles the monetization question by showing it.** The Export screen
reads "1080 × 1920 · 30 fps · no watermark" and the free-tier line under it reads
"3 free exports left", because that is what `free-tier.ts` does. ASO.md's full
description still promises that "Free exports carry a small watermark in the
corner", which this screenshot disproves in the same listing it sits in.
PLAY-CONSOLE.md already carries the corrected description; **ASO.md is the file
that still needs fixing before any of this is uploaded.**

Three things the device has to be put into first, none of them obvious:

- **Turn off the dev-launcher bubble.** Shake or `adb shell input keyevent 82`,
  scroll to **Tools button**, switch it off. Cropping cannot save Export, which
  is exactly where the bubble parks.
- **Put SystemUI into demo mode** so the status bar is a product's rather than a
  developer's afternoon: `adb shell settings put global sysui_demo_allowed 1`,
  then broadcasts to `com.android.systemui.demo` setting `clock -e hhmm 0930`,
  `battery -e level 100 -e plugged false`, `network -e wifi show -e level 4 -e
  fully true`, `network -e mobile hide`, `notifications -e visible false`. Exit
  with `-e command exit` afterwards.
- **Use the 3:02 clip for shot 2.** On a fast machine `base.en` finishes a 0:20
  clip between two `adb exec-out screencap` calls — thirty capture attempts over
  the short clip caught the Processing screen only in its "Getting audio · 0%"
  stage, never once in Transcribing. `make-demo-clip.py xlong` makes the stage
  last about fifteen seconds, which is how the 85% frame was got.

One trap that cost an hour: **the emulator ran out of disk**, and what that looks
like is not an error. `installd` starts purging the app's cache — the log line is
`Purging /data/data/com.wordburn.app/cache/ExponentAsset-….ttf` — the picker's
`cache/ImagePicker` copy vanishes before the app can open it, and the app boots
to a blank screen with Metro running fine. `adb shell df -h /data/user/0` is the
check. Everything above was taken with about 440 MB free and it was marginal.

The plate the captures sit on:

```
A vertical 1080x1920 background plate, flat, no text, no device.

Solid warm near-black #0F0E0D filling the frame, with a single very subtle
warm charcoal #1A1817 shape occupying the lower half — one large soft-edged
rounded form, low contrast, barely visible, no hard boundary.

Nothing else. No phone, no hands, no people, no gradient banding, no glow,
no light leaks, no text, no letters, no logos, no UI elements. Almost
entirely empty and dark. This is a backdrop for a screenshot to be placed
on top of.
```

Compose each shot as: plate, headline in Be Vietnam Pro ExtraBold `#F2EFEC` at
around 72 px across the top ~15%, screen capture below it with a `#2C2926`
hairline border and no rounded corners — the app draws video at `radius.video: 0`
and a rounded corner in a screenshot is a promise the export does not keep.

The spec above said the capture should sit at about 82% width. It does not: a
1440 × 3120 capture with the status bar and the gesture pill cropped off is
1440 × 2910, and at 82% of 1080 it would run six hundred pixels past the bottom
of the frame. `make-screenshots.py` fits it to the band the headline leaves
instead, which comes out near 70%. The headline is fitted too, from 72 px down
to 48 — "Fix a word without moving its timing" is twice the length of "Captions,
burned in", and one size for both either wraps to three lines or wastes the band.

Shot 3 is the one to lead with if only a few get looked at: live style tiles
animating the user's own words is the thing no competitor screenshot shows.

## Promo video thumbnail — 1280 × 720

Only needed if a YouTube promo video gets made, which is optional and is the
last thing to do. Same plate as the feature graphic at 16:9, with **Offline
auto-captions** set in Be Vietnam Pro ExtraBold `#F2EFEC` at around 90 px on the
left. YouTube's own timestamp sits bottom-right; leave that corner empty.

## Before uploading

- Icon at 48dp on a real A54 home screen, next to a word game, and it does not
  look like one. Everything above this line was judged in Pillow, which is not
  a launcher.
- Icon has square corners and no shadow of its own.
- Feature graphic has no alpha channel. A PNG with alpha is rejected.
- Nothing in any graphic claims a feature the app does not have — no TikTok,
  Reels or Shorts logos, no "AI", no language other than English on screen.
- The adaptive foreground survives a circle mask, a squircle mask and a
  rounded-square mask. Checked in software; check it again in the launcher's own
  icon shape setting on the A54, which is the only authority.
- Screenshots are 9:16 and every one of them was captured, not composed.
