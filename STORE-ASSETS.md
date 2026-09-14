# Store graphics

Prompts for generating the Play Store art, and the specs they have to hit.
Companion to ASO.md, which carries the text. The icon exists: three
left-aligned caption pills with the active one in the accent yellow, cut at
every size by `scripts/make-icons.py`, with the vector in `store/`. The
feature graphic and the screenshots do not exist yet.

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
| 3 | Style sheet, four tiles live | **Four styles, word by word** |
| 4 | Word sheet open on a flagged word | **Fix a word without moving its timing** |
| 5 | Timing sheet, waveform and handles | **Drag the timing on the waveform** |
| 6 | Dictionary list | **Teach it how you spell your name** |
| 7 | Export screen | **Full quality, straight to your gallery** |
| 8 | Home with the free-tier line | **Pay once. No subscription.** |

Shot 8 cannot be taken until the monetization question in ASO.md is settled.
The listing text describes a watermark tier and the code ships a three-export
counter; a screenshot showing one while the description promises the other is
the same violation from the other direction.

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
around 72 px across the top ~15%, screen capture below it at about 82% width
with a `#2C2926` hairline border and no rounded corners — the app draws video
at `radius.video: 0` and a rounded corner in a screenshot is a promise the
export does not keep.

Shot 3 is the one to lead with if only a few get looked at: four live style
tiles is the thing no competitor screenshot shows.

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
